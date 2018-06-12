const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const Utils = require('../support/Utils.js');
const {CompanyList} = require('../support/CompanyList');

const web3 = new Web3(ganache.provider());

const compiledContract = require('../ethereum/build/TopCompanyFactory.json');

let contract;
let accounts;
let defaultGas = 6000000;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    contract = await new web3.eth.Contract(JSON.parse(compiledContract.interface))
                    .deploy({data: compiledContract.bytecode, arguments: []})
                    .send({from: accounts[0], gas: defaultGas});
});

describe('Top Company factory contract', function() {
    this.timeout(90000);

    it('deploy contract', async () => {
        assert.ok(contract.options.address);
    });

    it('check names length', async() => {
        for (var i=0;i<CompanyList.length;i++) {
            if (CompanyList[i][0].length > 32) {
                console.log(CompanyList[i][0]);
            }
        }
        assert(true);
    })

    it('can add company', async() => {
        var list = getCompanies(0, 50);
        await contract.methods.addCompanies(list.names, list.performances, list.logoUrls, list.names.length)
            .send({from: accounts[0], gas: defaultGas});

        var c = await contract.methods.getCompany(15).call();
        assert.equal(Utils.hexToString(c.name), CompanyList[14][0]);
        assert.equal(Utils.hexToString(c.logoUrl), CompanyList[14][1]);
    });

    it('can add all companies', async() => {
        for (var i=0;i<=CompanyList.length/50;i++) {
            var list = getCompanies(i*50, (i+1) * 50);
            if (list.names.length > 0) {
                await contract.methods.addCompanies(list.names, list.performances, list.logoUrls, list.names.length)
                    .send({from: accounts[0], gas: defaultGas});
            }
        }

        var c = await contract.methods.getCompanyByName(Utils.stringToHex(CompanyList[184][0].toLowerCase())).call();
        assert.equal(Utils.hexToString(c.name), CompanyList[184][0]);
        assert.equal(Utils.hexToString(c.logoUrl), CompanyList[184][1]);

        var canbuy184 = await contract.methods.canBuyCompany(Utils.stringToHex(CompanyList[184][0].toLowerCase())).call();
        assert.equal(canbuy184, false);

        var canbuy60 = await contract.methods.canBuyCompany(Utils.stringToHex(CompanyList[60][0].toLowerCase())).call();
        assert.equal(canbuy60, true);
        
        var removeResult = await contract.methods.removeCompany(Utils.stringToHex(CompanyList[60][0].toLowerCase()))
            .send({from: accounts[0], gas: defaultGas});
        var hasError = false;
        try {
            await contract.methods.getCompanyByName(Utils.stringToHex(CompanyList[60][0].toLowerCase())).call();
        } catch (err) {
            if (err) {
                console.log(err.message);
                hasError = true;
            }
        }
        assert(hasError);

        var removeResult = await contract.methods.removeCompany(Utils.stringToHex(CompanyList[82][0].toLowerCase()))
            .send({from: accounts[0], gas: defaultGas});
        var c = await contract.methods.getCompanyByName(Utils.stringToHex(CompanyList[82][0].toLowerCase())).call();
        assert.equal(Utils.hexToString(c.name), CompanyList[82][0]);
    });

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