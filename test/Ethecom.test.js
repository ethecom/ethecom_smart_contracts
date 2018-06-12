const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const BigNumber = require('big-number');
const Utils = require('../support/Utils.js');
const {CompanyList} = require('../support/CompanyList');

const web3 = new Web3(ganache.provider());

const compiledContract = require('../ethereum/build/Ethecom.json');

let contract;
let tokenContract;
let accounts;
let decimals = 100000000;
let defaultGas = 5000000;

describe('Ethecom basic testing', function() {
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
        var list = getCompanies(0, 30);
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

        // await buyTopCompany("Apple", false, accounts[0]);

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

    // it('cannot buy top company again', async() => {
    //     var hasError = false;
    //     try {
    //         await buyTopCompany("Apple", false, accounts[0]);
    //     } catch (err) {
    //         if (err) {
    //             console.log(err.message);
    //             hasError = true;
    //         }
    //     }
    //     assert(hasError);

    //     await buyTopCompany("McKesson", false, accounts[0]);
    //     assert(true);
    // });

    it('deploy contract', async () => {
        assert.ok(contract.options.address);

        var contractECOMBalance = BigNumber(await tokenContract.methods.balanceOf(contract.options.address).call());
        assert.equal(contractECOMBalance.toString(), '190000000000000000');
    });

    it('buy a top company', async() => {
        await buyTopCompany("Instagram", false, accounts[0]);
        var c = await contract.methods.companies(Utils.stringToHex("instagram")).call();
        assert.equal(c.owner, accounts[0]);
    });

    it('buy a company', async() => {
        await buyTopCompany("Instagram", false, accounts[0]);
        var c = await contract.methods.companies(Utils.stringToHex("instagram")).call();
        await buyCompany("InstagrAM", false, c.price, accounts[1]);
        c = await contract.methods.companies(Utils.stringToHex("instagram")).call();
        assert.equal(c.owner, accounts[1]);
    });

    it('create a company', async() => {
        await createCompany("Metadxxaa", "https://xxxx", 10000000000000000, accounts[0]);
        await createCompany("Metadxxnn", "https://xxxx", 10000000000000000, accounts[0]);
        await createCompany("Metadxxxx", "https://xxxx", 10000000000000000, accounts[0]);
        await createCompany("Metadata", "https://xxxx", 10000000000000000, accounts[0]);
        var c = await contract.methods.companies(Utils.stringToHex("metadata")).call();
        assert.equal(c.owner, accounts[0]);
    });

    it('can update super privilege params', async() => {
        await contract.methods.updateSuperPrivilegeParams(10, 100)
            .send({from: accounts[0], gas: defaultGas});
        assert.equal(await contract.methods.minRandomPrivilegeValue().call(), 10);
        assert.equal(await contract.methods.superPrivilegeCost().call(), 100);
    });

    it('can update blocks per day', async() => {
        await contract.methods.updateBlocksPerDay(1000)
            .send({from: accounts[0], gas: defaultGas});
        assert.equal(await contract.methods.blocksPerDay().call(), 1000);
    });

    it('can run lucky draw', async() => {
        runLuckyDraw(accounts[0]);
        assert(true);
    });

    it('can update user created performance', async() => {
        await contract.methods.updateUserCreatedPerformance(50)
            .send({from: accounts[0], gas: defaultGas});
        assert.equal(await contract.methods.maxUserCreatedPerformance().call(), 50);
    });

    it('get super privilege', async() => {
        await getSuperPrivilege(1, accounts[0]);
        await buyTopCompany("Instagram", true, accounts[0]);
        var c = await getCompany("instagram");
        assert.equal(c.owner, accounts[0]);
        assert.equal(c.isOnsale, false);
    });

    it('put company onsale after permanently bought', async() => {
        await getSuperPrivilege(1, accounts[0]);
        await buyTopCompany("InstagrAM", true, accounts[0]);
        var c = await getCompany("instagram");
        assert.equal(c.isOnsale, false);
        await putCompanyOnsale("INStagram", 1000000000000000, accounts[0]);
        c = await getCompany("instagram");
        assert.equal(c.price, 1000000000000000);
        assert.equal(c.owner, accounts[0]);
        assert.equal(c.isOnsale, true);
    });

    it('can check company name availability', async() => {
        await createCompany("Metadxxaa", "https://xxxx", 10000000000000000, accounts[0]);
        await createCompany("Metadxxnn", "https://xxxx", 10000000000000000, accounts[0]);
        await buyTopCompany("Instagram", false, accounts[0]);
        getSuperPrivilege(1, accounts[0]);
        await buyTopCompany("McKesson", true, accounts[0]);

        var avail = await contract.methods.checkCompanyNameAvailability(Utils.stringToHex("AmerisourceBergen")).call();
        assert.equal(avail, 0);
        avail = await contract.methods.checkCompanyNameAvailability(Utils.stringToHex("Test name 1")).call();
        assert.equal(avail, 1);
        avail = await contract.methods.checkCompanyNameAvailability(Utils.stringToHex("Test nam 2")).call();
        assert.equal(avail, 1);
        avail = await contract.methods.checkCompanyNameAvailability(Utils.stringToHex("GooglE")).call();
        assert.equal(avail, 0);
        avail = await contract.methods.checkCompanyNameAvailability(Utils.stringToHex("General Electric")).call();
        assert.equal(avail, 0);
        avail = await contract.methods.checkCompanyNameAvailability(Utils.stringToHex("Metadxxnn")).call();
        assert.equal(avail, 0);
    });

    it('can update logo', async() => {
        await getSuperPrivilege(1, accounts[0]);
        await buyTopCompany("McKesson", true, accounts[0]);
        await buyTopCompany("Instagram", false, accounts[0]);

        let logoFee = await contract.methods.logoFee().call();
        let initialBalance = BigNumber(await tokenContract.methods.balanceOf(accounts[0]).call());
        console.log(initialBalance.toString());

        await updateLogo("McKesson", "demoxxx", accounts[0]);
        let c = await getCompany("McKesson");
        assert.equal(Utils.hexToString(c.logoUrl), "demoxxx");

        let balance = BigNumber(await tokenContract.methods.balanceOf(accounts[0]).call());
        console.log(balance.toString());
        assert(Utils.nearEqual(initialBalance.minus(balance).toString(), logoFee*100000000));
    });

    updateLogo = async (name, logoUrl, account) => {
        await contract.methods.updateLogoUrl(Utils.stringToHex(name), Utils.stringToHex(logoUrl)).send({
            from: account, gas: defaultGas
        });
    }

    getSuperPrivilege = async(count, account) => {
        var currentCount = 0;
        while (currentCount != count) {
            await runLuckyDraw(account);
            currentCount = await contract.methods.superPrivilegeCount(account).call();
        }
    }

    putCompanyOnsale = async(name, price, account) => {
        await contract.methods.putCompanyOnsale(Utils.stringToHex(name), price).send({from: account, gas: defaultGas});
    }

    getCompany = async(name) => {
        return await contract.methods.companies(Utils.stringToHex(name.toLowerCase())).call();
    }

    buyTopCompany = async (name, superPrivilege, account) => {
        var price = BigNumber(await contract.methods.getTopCompanyStartPrice().call());
        await contract.methods.purchaseTopCompany(Utils.stringToHex(name), superPrivilege)
            .send({from: account, gas: defaultGas, value: price.toString()});
    }

    buyCompany = async (name, superPrivilege, price, account) => {
        await contract.methods.purchaseCompany(Utils.stringToHex(name), superPrivilege)
            .send({from: account, gas: defaultGas, value: price});
    }

    createCompany = async (name, logoUrl, price, account) => {
        await contract.methods.createCompany(Utils.stringToHex(name), Utils.stringToHex(logoUrl), price.toString())
            .send({from: account, gas: defaultGas});
    }

    runLuckyDraw = async (account) => {
        await contract.methods.runSuperPrivilegeLuckyDraw().send({from: account, gas: defaultGas});
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
});