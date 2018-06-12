const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');

const web3 = new Web3(ganache.provider());

const compiledContract = require('../ethereum/build/ECOMToken.json');

let contract;
let accounts;
let decimals = 100000000;
let defaultGas = 5000000;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    contract = await new web3.eth.Contract(JSON.parse(compiledContract.interface))
                    .deploy({data: compiledContract.bytecode, arguments: [2000000000 * decimals, 'Ethecom Token', 8, 'ECOM']})
                    .send({from: accounts[0], gas: defaultGas});
});

describe('ECOMToken contract', () => {
    it('deploy contract', async () => {
        assert.ok(contract.options.address);
    });

    it('has correct total supply', async () => {
        const totalSupply = await contract.methods.balanceOf(accounts[0]).call();
        assert.equal(totalSupply, 2000000000 * decimals);
    });

    it('can transfer', async () => {
        await contract.methods.transfer(accounts[1], 2000*decimals)
                .send({from: accounts[0], gas: defaultGas});
        const account1Balance = await contract.methods.balanceOf(accounts[1]).call();
        assert.equal(account1Balance, 2000 * decimals);

        const account0Balance = await contract.methods.balanceOf(accounts[0]).call();
        assert.equal(account0Balance, (2000000000 - 2000) * decimals);
    });

    it('cannot transfer more than balance', async () => {
        await contract.methods.transfer(accounts[1], 2000*decimals)
                .send({from: accounts[0], gas: defaultGas});
        await contract.methods.transfer(accounts[2], 1000*decimals)
                .send({from: accounts[1], gas: defaultGas});
        var hasError = false;
        try {
            await contract.methods.transfer(accounts[2], 2000*decimals)
                .send({from: accounts[1], gas: defaultGas});
        } catch (err) {
            console.log(err.message);
            if (err) {
                hasError = true;
            }
        }
        assert(hasError);

        const account2Balance = await contract.methods.balanceOf(accounts[2]).call();
        assert.equal(account2Balance, 1000 * decimals);
    });

    it('can approve and transfer', async () => {
        await contract.methods.approve(accounts[1], 5000*decimals)
            .send({from: accounts[0], gas: defaultGas});
        var hasError = false;
        try { 
            await contract.methods.transferFrom(accounts[0], accounts[2], 5000*decimals)
                .send({from: accounts[3], gas: defaultGas});
        } catch (err) {
            console.log(err.message);
            if (err) {
                hasError = true;
            }
        }
        assert(hasError);
        
        await contract.methods.transferFrom(accounts[0], accounts[2], 3000*decimals)
            .send({from: accounts[1], gas: defaultGas});

        const account2Balance = await contract.methods.balanceOf(accounts[2]).call();
        assert.equal(account2Balance, 3000 * decimals);
    });

    it('owner can approve and transfer', async () => {
        await contract.methods.transferOwnership(accounts[3]).send({
            from: accounts[0],
            gas: defaultGas
        });

        var hasError = false;
        try { 
            await contract.methods.ownerApprove(accounts[0], 3000*decimals)
                .send({from: accounts[0], gas: defaultGas});
        } catch (err) {
            console.log(err.message);
            if (err) {
                hasError = true;
            }
        }
        assert(hasError);
        
        await contract.methods.ownerApprove(accounts[0], 3000*decimals)
            .send({from: accounts[3], gas: defaultGas});
        await contract.methods.transferFrom(accounts[0], accounts[1], 3000*decimals)
            .send({from: accounts[3], gas: defaultGas});

        const account1Balance = await contract.methods.balanceOf(accounts[1]).call();
        assert.equal(account1Balance, 3000 * decimals);
    });
});