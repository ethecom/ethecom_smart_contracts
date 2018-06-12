const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');

const web3 = new Web3(ganache.provider());

const compiledContract = require('../ethereum/build/CompanyCost.json');

let contract;
let accounts;
let defaultGas = 5000000;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    contract = await new web3.eth.Contract(JSON.parse(compiledContract.interface))
                    .deploy({data: compiledContract.bytecode, arguments: []})
                    .send({from: accounts[0], gas: defaultGas});
});

describe('Company cost contract', function() {
    this.timeout(30000);

    it('deploy contract', async () => {
        assert.ok(contract.options.address);
    });

    it('show correct cost', async() => {
        for (var i=0;i<10;i++) {
            await contract.methods.increaseCompanyCountByOne().send({from: accounts[0], gas: defaultGas});
        }

        var cost = await contract.methods.getCreationCost().call();
        assert.equal(cost, 8);

        for (var i=0;i<200;i++) {
            await contract.methods.increaseCompanyCountByOne().send({from: accounts[0], gas: defaultGas});
        }

        cost = await contract.methods.getCreationCost().call();
        assert.equal(cost, 20);
    });

    it('only owner can increase count', async() => {
        var hasError = false;
        try {
            await contract.methods.increaseCompanyCountByOne().send({from: accounts[1], gas: defaultGas});
        } catch (err) {
            console.log(err.message);
            if (err) {
                hasError = true;
            }
        }
        assert(hasError);
    });

    it('calculate next / previous price', async() => {
        var currentPrice = web3.utils.toWei('0.01', 'ether');
        for (var i=0;i<10;i++) {
            currentPrice = await contract.methods.calculateNextPrice(currentPrice.toString()).call();
            console.log(currentPrice);
        }

        currentPrice = web3.utils.toWei('0.001', 'ether');
        newPrice = await contract.methods.calculateNextPrice(currentPrice).call();
        assert.equal(newPrice.toString(), (currentPrice * 20 / 10).toString());
        previousPrice = await contract.methods.calculatePreviousPrice(newPrice).call();
        assert.equal(previousPrice, currentPrice);

        currentPrice = web3.utils.toWei('0.7', 'ether');
        newPrice = await contract.methods.calculateNextPrice(currentPrice).call();
        assert.equal(newPrice.toString(), (currentPrice * 16 / 10).toString());
        previousPrice = await contract.methods.calculatePreviousPrice(newPrice).call();
        assert.equal(previousPrice, currentPrice);

        currentPrice = web3.utils.toWei('2', 'ether');
        newPrice = await contract.methods.calculateNextPrice(currentPrice).call();
        assert.equal(newPrice.toString(), (currentPrice * 14 / 10).toString());
        previousPrice = await contract.methods.calculatePreviousPrice(newPrice).call();
        assert.equal(previousPrice, currentPrice);

        currentPrice = web3.utils.toWei('5', 'ether');
        newPrice = await contract.methods.calculateNextPrice(currentPrice).call();
        assert.equal(newPrice.toString(), (currentPrice * 12 / 10).toString());
        previousPrice = await contract.methods.calculatePreviousPrice(newPrice).call();
        assert.equal(previousPrice, currentPrice);

        currentPrice = web3.utils.toWei('6', 'ether');
        newPrice = await contract.methods.calculateNextPrice(currentPrice).call();
        assert.equal(newPrice.toString(), (currentPrice * 12 / 10).toString());
        previousPrice = await contract.methods.calculatePreviousPrice(newPrice).call();
        assert.equal(previousPrice, currentPrice);

        currentPrice = web3.utils.toWei('11', 'ether');
        newPrice = await contract.methods.calculateNextPrice(currentPrice).call();
        assert.equal(newPrice.toString(), (currentPrice * 11 / 10).toString());
        previousPrice = await contract.methods.calculatePreviousPrice(newPrice).call();
        assert.equal(previousPrice, currentPrice);

        previousPrice = await contract.methods.calculatePreviousPrice(1).call();
        assert.equal(previousPrice, '0');

        assert(true);
    });
});