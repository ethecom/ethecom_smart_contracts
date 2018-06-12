const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const BigNumber = require('big-number');

const web3 = new Web3(ganache.provider());

const compiledContract = require('../ethereum/build/RandomGenerator.json');

let contract;
let accounts;
let defaultGas = 5000000;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    contract = await new web3.eth.Contract(JSON.parse(compiledContract.interface))
                    .deploy({data: compiledContract.bytecode, arguments: []})
                    .send({from: accounts[0], gas: defaultGas, gasPrice: '100'});
});

describe('Random generator contract', function() {
    it('deploy contract', async () => {
        assert.ok(contract.options.address);
    });

    it('can random', async() => {
        var account0Balance = BigNumber(await web3.eth.getBalance(accounts[0]));
        console.log('Initial balance: ' + account0Balance);
        // Value is the transaction information, not the expected random value, only contract can call contract methods
        var value = await contract.methods.rand(accounts[0]).send({from: accounts[0], gas: defaultGas, gasPrice: '100'});
        var cost = value.gasUsed * 100;
        var account0NewBalance = BigNumber(await web3.eth.getBalance(accounts[0]));
        assert(value);
        console.log(account0Balance + ":" + cost + ":" + account0NewBalance);
        assert.equal(account0NewBalance.toString(), account0Balance.minus(cost).toString());
    });

    it('only owner can call', async() => {
        var hasError = false;
        try {
            await contract.methods.rand(accounts[1]).send({from: accounts[1], gas: defaultGas});
        } catch (err) {
            console.log(err.message);
            if (err) {
                hasError = true;
            }
        }
        assert(hasError);
    });
});