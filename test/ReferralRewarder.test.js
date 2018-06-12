const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const BigNumber = require('big-number');

const web3 = new Web3(ganache.provider());

const compiledContract = require('../ethereum/build/ReferralRewarder.json');

let contract;
let accounts;
let defaultGas = 5000000;
let tokenContract;
let decimals = 100000000;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    tokenCompiledContract = require('../ethereum/build/ECOMToken.json');
    tokenContract = await new web3.eth.Contract(JSON.parse(tokenCompiledContract.interface))
        .deploy({data: tokenCompiledContract.bytecode, arguments: [2000000000 * decimals, 'Ethecom Token', 8, 'ECOM']})
        .send({from: accounts[0], gas: defaultGas});

    contract = await new web3.eth.Contract(JSON.parse(compiledContract.interface))
                    .deploy({data: compiledContract.bytecode, arguments: [tokenContract.options.address]})
                    .send({from: accounts[0], gas: defaultGas});

    await tokenContract.methods.transfer(contract.options.address, 1000000 * decimals)
        .send({from: accounts[0], gas: defaultGas});
});

describe('Referral rewarder contract', function() {
    this.timeout(90000);
    it('deploy contract', async () => {
        assert.ok(contract.options.address);
        var balance = await tokenContract.methods.balanceOf(contract.options.address).call();
        assert.equal(balance, 1000000 * decimals);
    });

    // It is only safe to send to around 100 users at a time.
    it('can send reward to many users', async() => {
        var receivers = [];
        var amounts = [];
        for (var i=0;i<100;i++) {
            receivers.push(accounts[1]);
            amounts.push(2);
        }
        var result = await contract.methods.reward(receivers, amounts, receivers.length)
            .send({from: accounts[0], gas: defaultGas});
        assert(result);
        console.log(result);
    })
});