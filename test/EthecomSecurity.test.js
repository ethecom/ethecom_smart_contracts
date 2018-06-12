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

describe('Ethecom security testing', function() {
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
        list = getCompanies(41, 80);
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

    it('cannot buy a company with a price lower than listed price', async() => {
        await buyTopCompany("Instagram", false, accounts[0]);
        var c = await getCompany("Instagram");
        await buyCompany("Instagram", false, c.price, accounts[1]);

        var hasError = false;
        try {
            await buyCompany("Instagram", false, c.price, accounts[2]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    });

    it('cannot buy your own company', async() => {
        await buyTopCompany("Instagram", false, accounts[0]);
        var c = await getCompany("Instagram");
        var hasError = false;
        try {
            await buyCompany("Instagram", false, c.price, accounts[0]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    });

    it('cannot buy an offsale company', async() => {
        await getSuperPrivilege(1, accounts[0]);
        await buyTopCompany("Instagram", true, accounts[0]);
        var c = await getCompany("Instagram");
        var hasError = false;
        try {
            await buyCompany("Instagram", false, c.price, accounts[1]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    });

    it('cannot buy a company not ready for sale', async() => {
        var currentBlock = await getCurrentBlockNumber();
        var startBlock = await contract.methods.getTopCompanyStartBlock().call(); // ganache start at block 0, so, getTopCompanyStartBlock got overflow
        var blocksInBetween = await contract.methods.getTopCompanyBlocksInBetween().call();

        var availableIndex = Math.floor((currentBlock - startBlock) / blocksInBetween);

        console.log('available index: ' + currentBlock + ":" + startBlock + ":" + blocksInBetween + ":" + availableIndex);

        var company = await contract.methods.getTopCompanyAtIndex(availableIndex).call();
        await buyTopCompany(Utils.hexToString(company[0]), false, accounts[1]);

        var hasError = false;
        try {
            var notAvailableCompany = await contract.methods.getTopCompanyAtIndex(availableIndex + 1).call();
            await buyTopCompany(Utils.hexToString(notAvailableCompany[0]), false, accounts[1]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    });

    it('cannot create company with no token', async() => {
        let hasError = false;
        try {
            await createCompany("xxxx", "xxx", 3000000000000000, accounts[5]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    });

    it('cannot claim when there is no companies', async() => {
        var hasError = false;
        try {
            await contract.methods.claimMyToken().send({from: accounts[1], gas: defaultGas});
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    });

    it('only owner can update blocks per day', async() => {
        await contract.methods.transferOwnership(accounts[3]).send({from: accounts[0], gas: defaultGas});

        var hasError = false;
        try {
            await contract.methods.updateBlocksPerDay(1000).send({from: accounts[0]});
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);

        await contract.methods.updateBlocksPerDay(1000).send({from: accounts[3]});
        let currentBlockPerDay = await contract.methods.blocksPerDay().call();
        assert.equal(currentBlockPerDay, 1000);
    })

    it('cannot own other people company', async() => {
        await buyTopCompany("Walmart", false, accounts[1]);
        
        var hasError = false;
        try {
            await permanentlyOwn('walmart', accounts[0]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    })

    it('cannot own permanently own a top company', async() => {
        var hasError = false;
        try {
            await permanentlyOwn("Walmart", 3000000000000000, accounts[1]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    });

    it('cannot own a permanently owned company', async() => {
        await getSuperPrivilege(1, accounts[1]);
        await buyTopCompany("Walmart", true, accounts[1]);

        var hasError = false;
        try {
            await permanentlyOwn('walmart', accounts[1]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    })

    it('cannot put other people company onsale', async() => {
        await getSuperPrivilege(1, accounts[1]);
        await buyTopCompany("Walmart", true, accounts[1]);
        await createCompany("Hello", "xxx", 3000000000000000, accounts[1]);

        var hasError = false;
        try {
            await putCompanyOnsale('Walmart', 3000000000000000, accounts[0]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);

        await putCompanyOnsale('Walmart', 10000000000000000, accounts[1]);
        assert(true);
    })

    it('cannot put an onsale company onsale', async() => {
        await getSuperPrivilege(1, accounts[1]);
        await buyTopCompany("Walmart", false, accounts[1]);
        await createCompany("Hello", "xxx", 3000000000000000, accounts[1]);

        var hasError = false;
        try {
            await putCompanyOnsale("Walmart", 3000000000000000, accounts[1]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
    });

    it('cannot put a top company onsale', async() => {
        var hasError = false;
        try {
            await putCompanyOnsale("Walmart", 3000000000000000, accounts[1]);
        } catch (err) {
            hasError = true;
            console.log(err.message);
        }
        assert(hasError);
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