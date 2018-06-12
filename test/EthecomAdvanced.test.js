const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const BigNumber = require('big-number');
const Utils = require('../support/Utils.js');
const {CompanyList} = require('../support/CompanyList');

const web3 = new Web3(ganache.provider({'time': new Date('2015-03-25'), 'debug': true}));

const compiledContract = require('../ethereum/build/Ethecom.json');

let contract;
let tokenContract;
let accounts;
let decimals = 100000000;
let defaultGas = 5000000;
let gasPrice = 10000;

describe('Ethecom advanced testing', function() {
    this.timeout(90000);

    beforeEach(async () => {
        accounts = await web3.eth.getAccounts();
    
        const compiledTokenContract = require('../ethereum/build/ECOMToken.json');
        tokenContract = await new web3.eth.Contract(JSON.parse(compiledTokenContract.interface))
            .deploy({data: compiledTokenContract.bytecode, arguments: [2000000000 * decimals, 'Ethecom Token', 8, 'ECOM']})
            .send({from: accounts[0], gas: defaultGas});
    
        const compiledCostContract = require('../ethereum/build/CompanyCost.json');
        const costContract = await new web3.eth.Contract(JSON.parse(compiledCostContract.interface))
            .deploy({data: compiledCostContract.bytecode, arguments: []})
            .send({from: accounts[0], gas: defaultGas});
    
        const compiledRandContract = require('../ethereum/build/RandomGenerator.json');
        const randContract = await new web3.eth.Contract(JSON.parse(compiledRandContract.interface))
            .deploy({data: compiledRandContract.bytecode, arguments: []})
            .send({from: accounts[0], gas: defaultGas});
    
        const compiledFactoryContract = require('../ethereum/build/TopCompanyFactory.json');
        const factoryContract = await new web3.eth.Contract(JSON.parse(compiledFactoryContract.interface))
            .deploy({data: compiledFactoryContract.bytecode, arguments: []})
            .send({from: accounts[0], gas: defaultGas});
        var list = getCompanies(0, 40);
        await factoryContract.methods.addCompanies(list.names, list.performances, list.logoUrls, list.names.length)
                .send({from: accounts[0], gas: defaultGas});
    
        contract = await new web3.eth.Contract(JSON.parse(compiledContract.interface))
                        .deploy({
                            data: compiledContract.bytecode, 
                            arguments: [
                                tokenContract.options.address,
                                factoryContract.options.address,
                                randContract.options.address,
                                costContract.options.address
                            ]
                        })
                        .send({from: accounts[0], gas: '5000000'});
    
        await tokenContract.methods.transfer(contract.options.address, BigNumber(1900000000).mult(decimals).toString())
            .send({from: accounts[0], gas: defaultGas});
    
        await tokenContract.methods.transfer(accounts[1], BigNumber(100000).mult(decimals).toString())
            .send({from: accounts[0], gas: defaultGas});
    
        await tokenContract.methods.transferOwnership(contract.options.address)
            .send({from: accounts[0], gas: defaultGas});
        await factoryContract.methods.transferOwnership(contract.options.address)
            .send({from: accounts[0], gas: defaultGas});
        await randContract.methods.transferOwnership(contract.options.address)
            .send({from: accounts[0], gas: defaultGas});
        await costContract.methods.transferOwnership(contract.options.address)
            .send({from: accounts[0], gas: defaultGas});
    
        await contract.methods.updateSuperPrivilegeParams(10, 100)
            .send({from: accounts[0], gas: defaultGas});

        let compiledFactoryFixed = require('../ethereum/build/FactoryFixed.json');

        const factoryFixedContract = await new web3.eth.Contract(JSON.parse(compiledFactoryFixed.interface))
                .deploy({data: compiledFactoryFixed.bytecode, arguments: [factoryContract.options.address]})
                .send({from: accounts[0], gas: defaultGas});
        var companyNames = [];
        for (var i=0;i<25;i++) {
                companyNames.push(Utils.stringToHex(CompanyList[i][0].toLowerCase()));
        }
        var result = await factoryFixedContract.methods.setCompaniesIndex(companyNames, 0, 24).send({
        from: accounts[0],
        gas: defaultGas
        });
        await contract.methods.updateFactoryContract(factoryFixedContract.options.address).send({
        from: accounts[0],
        gas: defaultGas
        });
        await factoryFixedContract.methods.transferOwnership(contract.options.address).send({
        from: accounts[0],
        gas: defaultGas
        })
    });

    it('deploy contract', async () => {
        assert.ok(contract.options.address);

        var contractECOMBalance = BigNumber(await tokenContract.methods.balanceOf(contract.options.address).call());
        assert.equal(contractECOMBalance.toString(), '190000000000000000');
    });

    it('calculate next price correctly', async() => {
        await buyTopCompany("InstagrAM", false, accounts[0]);
        var c = await getCompany("instagram");
        console.log('Price: ' + web3.utils.fromWei(c.price, 'ether') + ' eth');

        for (var i=0;i<5;i++) {
            await buyCompany("Instagram", false, c.price, accounts[(i+1)%2]);
            c = await getCompany("instagram");
            console.log('Price: ' + web3.utils.fromWei(c.price, 'ether') + ' eth');
        }

        assert(true);
    });

    it('test performance of creating company', async() => {
        var name;
        var c;

        var count = 10;
        var total = 0;
        for (var i=0;i<count;i++) {
            name = makeid(10);
            await createCompany(name, makeid(20), 1000000000000000, accounts[0]);
            c = await getCompany(name);
            total += parseInt(c.performance);
            console.log('Company ' + name + ': ' + c.performance);
        }
        console.log('Mean performance: ' + total / count);
        assert(true);
    });

    it('test lucky draw', async() => {
        for (var i=0;i<10;i++) {
            console.log('count: ' + i);
            await runLuckyDraw(accounts[0]);
        }
        console.log('Super privilege count: ' + await contract.methods.superPrivilegeCount(accounts[0]).call());
    });

    it('have correct balance after buying a company', async() => {
        await buyTopCompany("Instagram", false, accounts[0]);
        await buyTopCompany("Apple", false, accounts[0]);

        var c;
        c = await getCompany("Apple");
        await buyCompany("Apple", false, c.price, accounts[1]);
        c = await getCompany("Apple");
        await buyCompany("Apple", false, c.price, accounts[2]);
        c = await getCompany("Apple");
        await buyCompany("Apple", false, c.price, accounts[3]);

        var initialBalanceContract = BigNumber(await web3.eth.getBalance(contract.options.address));
        var initialBalance4 = BigNumber(await web3.eth.getBalance(accounts[4]));
        var initialBalance3 = BigNumber(await web3.eth.getBalance(accounts[3]));
        c = await getCompany("Apple");
        var tx = await buyCompany("Apple", false, c.price, accounts[4]);
        var txFee = BigNumber(tx.gasUsed).mult(gasPrice);
        var currentBalance4 = BigNumber(await web3.eth.getBalance(accounts[4]));
        var currentBalance3 = BigNumber(await web3.eth.getBalance(accounts[3]));
        assert.equal(currentBalance4.toString(), initialBalance4.minus(txFee).minus(c.price).toString());
        var profit = BigNumber(c.price).minus(BigNumber(c.lastPrice));
        var ownerProfit = profit.mult(80).div(100);
        assert.equal(currentBalance3.toString(), initialBalance3.plus(BigNumber(c.lastPrice).plus(ownerProfit)).toString());

        profit = BigNumber(c.price).minus(BigNumber(c.lastPrice));
        var contractProfit = profit.mult(20).div(100);
        var contractBalance = BigNumber(await web3.eth.getBalance(contract.options.address));
        assert.equal(contractBalance.toString(), initialBalanceContract.plus(contractProfit).toString());
    });

    it('have correct balance after creating a company', async() => {
        var initialBalanceContract = BigNumber(await tokenContract.methods.balanceOf(contract.options.address).call());
        var initialBalance0 = BigNumber(await tokenContract.methods.balanceOf(accounts[0]).call());
        var cost = await contract.methods.getCompanyCreationCost().call();
        cost = parseInt(cost) * decimals;
        await createCompany("xxxx", "xxx", 3000000000000000, accounts[0]);
        var balanceContract = BigNumber(await tokenContract.methods.balanceOf(contract.options.address).call());
        var balance0 = BigNumber(await tokenContract.methods.balanceOf(accounts[0]).call());

        assert.equal(balanceContract.toString(), initialBalanceContract.plus(cost).toString());
        assert.equal(balance0.toString(), initialBalance0.minus(cost).toString());
    });

    it('can buy a newly created company', async() => {
        await tokenContract.methods.transfer(accounts[2], 200 * decimals)
            .send({from: accounts[0], gas: defaultGas});
        assert.equal(await tokenContract.methods.balanceOf(accounts[2]).call(), 200*decimals);

        await createCompany("xxxx", "xxx", 3000000000000000, accounts[2]);
        var c = await getCompany("xxxx");
        await buyCompany("xxxx", false, c.price, accounts[1]);
        c = await getCompany("xxxx");
        assert.equal(c.owner, accounts[1]);
        assert.equal(c.price, 3000000000000000 * 2);
    });

    it('can claim my profit', async() => {
        await buyTopCompany("Instagram", false, accounts[2]);
        await buyTopCompany("General Motors", false, accounts[1]);
        var c;
        c = await getCompany("General Motors");
        await buyCompany("General Motors", false, c.price, accounts[0]);
        c = await getCompany("General Motors");
        await buyCompany("General Motors", false, c.price, accounts[1]);
        c = await getCompany("General Motors");
        await buyCompany("General Motors", false, c.price, accounts[0]);

        var performance = await contract.methods.ownedPerformance(accounts[2]).call();
        var lastClaimedBlock = await contract.methods.lastTokenClaimedBlock(accounts[2]).call();
        var blocksPerDay = await contract.methods.blocksPerDay().call();

        await contract.methods.claimMyToken().send({from: accounts[2], gasPrice: defaultGas});
        var actualBalance = await tokenContract.methods.balanceOf(accounts[2]).call();

        var currentBlock = await getCurrentBlockNumber();
        var expectedProfit = (performance * decimals / blocksPerDay) * (currentBlock - lastClaimedBlock);

        // lastClaimedBlock = await contract.methods.lastTokenClaimedBlock(accounts[2]).call();
        // console.log('balance: ' + actualBalance);
        // console.log('last claim block: ' + lastClaimedBlock + " : " + currentBlock);
        assert.equal(actualBalance, expectedProfit);
    });

    it('have correct total performance after selling buying companies 1', async() => {
        var expectedPerformance = 0;
        await buyTopCompany("Apple", false, accounts[3]);
        expectedPerformance += parseInt((await getCompany("Apple")).performance);
        assert.equal(await contract.methods.ownedPerformance(accounts[3]).call(), expectedPerformance);

        await buyTopCompany("General Motors", false, accounts[3]);
        expectedPerformance += parseInt((await getCompany("General Motors")).performance);
        assert.equal(await contract.methods.ownedPerformance(accounts[3]).call(), expectedPerformance);

        await buyTopCompany("Exxon Mobil", false, accounts[3]);
        expectedPerformance += parseInt((await getCompany("Exxon Mobil")).performance);
        assert.equal(await contract.methods.ownedPerformance(accounts[3]).call(), expectedPerformance);

        await buyCompany("Exxon Mobil", false, (await getCompany("Exxon Mobil")).price, accounts[4]);
        expectedPerformance -= parseInt((await getCompany("Exxon Mobil")).performance);
        console.log(expectedPerformance);
        assert.equal(await contract.methods.ownedPerformance(accounts[3]).call(), expectedPerformance);

        await buyCompany("Apple", false, (await getCompany("Apple")).price, accounts[4]);
        expectedPerformance -= parseInt((await getCompany("Apple")).performance);
        assert.equal(await contract.methods.ownedPerformance(accounts[3]).call(), expectedPerformance);
    });

    it('have correct total performance after selling buying companies 1', async() => {
        await tokenContract.methods.transfer(accounts[1], 1000 * decimals)
            .send({from: accounts[0], gas: defaultGas});

        var expectedPerformance = 0;
        await createCompany("minhnguye", "xxx", 1000000000000000, accounts[1]);
        expectedPerformance += parseInt((await getCompany("minhnguye")).performance);
        console.log('expected pf: ' + expectedPerformance);
        assert.equal(await contract.methods.ownedPerformance(accounts[1]).call(), expectedPerformance);

        await buyTopCompany("General Motors", false, accounts[1]);
        expectedPerformance += parseInt((await getCompany("General Motors")).performance);
        assert.equal(await contract.methods.ownedPerformance(accounts[1]).call(), expectedPerformance);

        await buyCompany("minhnguye", false, (await getCompany("minhnguye")).price, accounts[4]);
        expectedPerformance -= parseInt((await getCompany("minhnguye")).performance);
        assert.equal(await contract.methods.ownedPerformance(accounts[1]).call(), expectedPerformance);
    });

    it('have correct super privileges after buying, put on sale companies', async() => {
        await getSuperPrivilege(5, accounts[0]);
        let currentCount = await contract.methods.superPrivilegeCount(accounts[0]).call();;
        console.log('current super privilege count: ' + currentCount);
        await buyTopCompany("General Motors", true, accounts[0]);
        currentCount = await contract.methods.superPrivilegeCount(accounts[0]).call();
        assert.equal(currentCount, 4);

        await createCompany("minhnguye", "xxx", 1000000000000000, accounts[1]);
        await createCompany("leoz", "xxx", 1000000000000000, accounts[1]);
        await buyCompany("leoz", true, 1000000000000000, accounts[0]);

        currentCount = await contract.methods.superPrivilegeCount(accounts[0]).call();
        assert.equal(currentCount, 3);

        await createCompany("leozxx", "xxx", 1000000000000000, accounts[0]);
        await pullCompanyOffsale("leozxx", accounts[0]);

        currentCount = await contract.methods.superPrivilegeCount(accounts[0]).call();
        assert.equal(currentCount, 2);
    });

        permanentlyOwn = async (name, account) => {
            await contract.methods.permanentlyOwnMyCompany(Utils.stringToHex(name))
                    .send({from: account, gas: defaultGas});
        }

    getSuperPrivilege = async(count, account) => {
        var currentCount = 0;
        while (currentCount != count) {
            await runLuckyDraw(account);
            currentCount = await contract.methods.superPrivilegeCount(account).call();
        }
    }

    pullCompanyOffsale = async(name, account) => {
        await contract.methods.permanentlyOwnMyCompany(Utils.stringToHex(name)).send({
            from: account,
            gas: defaultGas
        });
    }

    putCompanyOnsale = async(name, price, account) => {
        await contract.methods.putCompanyOnsale(Utils.stringToHex(name), price).send({from: account, gas: defaultGas, gasPrice: gasPrice});
    }

    getCompany = async(name) => {
        return await contract.methods.companies(Utils.stringToHex(name.toLowerCase())).call();
    }

    buyTopCompany = async (name, superPrivilege, account) => {
        var price = BigNumber(await contract.methods.getTopCompanyStartPrice().call());
        return await contract.methods.purchaseTopCompany(Utils.stringToHex(name), superPrivilege)
            .send({from: account, gas: defaultGas, value: price.toString()});
    }

    buyCompany = async (name, superPrivilege, price, account) => {
        return await contract.methods.purchaseCompany(Utils.stringToHex(name), superPrivilege)
            .send({from: account, gas: defaultGas, value: price, gasPrice: gasPrice});
    }

    createCompany = async (name, logoUrl, price, account) => {
        return await contract.methods.createCompany(Utils.stringToHex(name), Utils.stringToHex(logoUrl), price.toString())
            .send({from: account, gas: defaultGas});
    }

    runLuckyDraw = async (account) => {
        return await contract.methods.runSuperPrivilegeLuckyDraw().send({from: account, gas: defaultGas});
    }

    getCurrentBlockNumber = async() => {
        return await web3.eth.getBlockNumber();
    }

    getCompanies = (from, to) => {
        var result = {};
        result.names = [];
        result.logoUrls = [];
        result.performances = [];
        for (var i=from;i<to;i++) {
            if (i >= CompanyList.length) {
                break;
            }
            result.names.push(Utils.stringToHex(CompanyList[i][0]));
            result.logoUrls.push(Utils.stringToHex(CompanyList[i][1]));
            var perf = 51 - i / 20;
            result.performances.push(perf);
        }
        return result;
    }

    function makeid(len) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      
        for (var i = 0; i < len; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));
      
        return text;
    }
});