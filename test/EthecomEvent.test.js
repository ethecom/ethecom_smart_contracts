const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const BigNumber = require('big-number');
const Utils = require('../support/Utils.js');

const web3 = new Web3(ganache.provider({'time': new Date('2015-03-25'), 'debug': true}));

const compiledContract = require('../ethereum/build/Ethecom.json');

let contract;
let tokenContract;
let accounts;
let decimals = 100000000;
let defaultGas = 5000000;
let gasPrice = 10000;

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
    await factoryContract.methods.setupBatch1().send({from: accounts[0], gas: defaultGas});

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
});

describe('Ethecom advanced testing', function() {
    this.timeout(90000);

    it('company created event', async() => {
        await createCompany("TesTEvnet", "xxx", 1000000, accounts[0]);

        var result = await contract.getPastEvents('CompanyCreated', {filter: {}, fromBlock: 0});
        var event = result[0].returnValues;

        assert.equal(Utils.hexToString(event.name), "TesTEvnet");
        assert.equal(parseInt(event.price), 1000000);
        assert.equal(event.owner, accounts[0]);

        await buyTopCompany("Facebook", false, accounts[1]);

        result = await contract.getPastEvents('CompanyCreated', {filter: {}, fromBlock: 0});
        event = result[1].returnValues;

        assert.equal(Utils.hexToString(event.name), "Facebook");
        // assert.equal(parseInt(event.price), 1000000);
        assert.equal(event.owner, accounts[1]);
    });

    it('company transferred event', async() => {
        await createCompany("TesTEvnet", "xxx", 1000000, accounts[0]);

        await buyCompany("TesTEvnet", false, 1000000, accounts[2]);

        var result = await contract.getPastEvents('CompanyTransferred', {filter: {}, fromBlock: 0});
        var event = result[0].returnValues;

        assert.equal(event.oldOwner, accounts[0]);
        assert.equal(event.owner, accounts[2]);
        assert.equal(parseInt(event.newPrice), 2000000);
    });

    it('company logo updated', async() => {
        await createCompany("TesTEvnet", "abc", 1000000, accounts[0]);
        await contract.methods.updateLogoUrl(Utils.stringToHex("TesTEvnet"), Utils.stringToHex("nnnxxx"))
            .send({from: accounts[0], gas: defaultGas});

        var result = await contract.getPastEvents('CompanyLogoUpdated', {filter: {}, fromBlock: 0});
        var event = result[0].returnValues;
        console.log(event);

        assert.equal(Utils.hexToString(event.logoUrl), "nnnxxx");
    });

    it('sale status events', async() => {
        getSuperPrivilege(1, accounts[0]);
        await buyTopCompany("Apple", true, accounts[0]);
        var result = await contract.getPastEvents('CompanySaleStatusChanged', {filter: {}, fromBlock: 0});
        var event = result[0].returnValues;
        assert(!event.saleStatus);

        await putCompanyOnsale("Apple", 1000000, accounts[0]);
        var result = await contract.getPastEvents('CompanySaleStatusChanged', {filter: {}, fromBlock: 0});
        var event = result[1].returnValues;
        assert(event.saleStatus);
    });

    it('super privilege lucky draw event', async() => {
        await runLuckyDraw(accounts[0]);
        var result = await contract.getPastEvents('SuperPrivilegeLuckyDrawResult', {filter: {}, fromBlock: 0});
        var event = result[0].returnValues;
        console.log(event);
        assert(event);
    });


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

    function makeid(len) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      
        for (var i = 0; i < len; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));
      
        return text;
    }
});