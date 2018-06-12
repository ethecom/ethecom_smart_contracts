pragma solidity ^0.4.21;

import "./TopCompanyFactoryInterface.sol";
import "./Utils.sol";

contract TopCompanyFactory is TopCompanyFactoryInterface {
    Utils utils;

    constructor() public {
        companyCount = 1;
        initialAvailableCount = 10;
        startPrice = 10000000000000000;
        blocksBetweenNewCompany = 416;
        startBlock = int256(block.number) - ((int256(initialAvailableCount) + 1) * int256(blocksBetweenNewCompany));
        companies.push(TopCompany("", 0, "")); // Make the first one empty as a mark

        utils = new Utils();
    }

    function updateBlocksBetweenNewCompany(uint256 newNumber) public onlyOwner {
        blocksBetweenNewCompany = newNumber;
    }

    function updateStartPrice(uint256 newPrice) public onlyOwner {
        startPrice = newPrice;
    }

    function canBuyCompany(bytes32 nameLowercase) public view onlyOwner returns (bool) {
        uint256 index = companiesIndex[nameLowercase];
        if (index == 0) {
            return false;
        }
        int256 availableBlock = startBlock + int256(index) * int256(blocksBetweenNewCompany);
        return availableBlock <= int256(block.number);
    }

    function getCompanyByName(bytes32 nameLowercase) public view returns (bytes32 name, uint256 performance, bytes32 logoUrl) {
        uint256 index = companiesIndex[nameLowercase];
        require(index != 0);
        return getCompany(index);
    }

    function getCompany(uint256 index) public view returns (bytes32 name, uint256 performance, bytes32 logoUrl) {
        TopCompany storage c = companies[index];
        return (c.name, c.performance, c.logoUrl);
    }

    function removeCompany(bytes32 nameLowercase) public onlyOwner returns (uint256) {
        // Check if company available for purchasing
        uint256 index = companiesIndex[nameLowercase];
        int256 availableBlock = startBlock + int256(index) * int256(blocksBetweenNewCompany);
        if (index != 0 && availableBlock <= int256(block.number)) {
            // Remove the company from the index because it will join another list in the core Ethecom contract
            companiesIndex[nameLowercase] = 0; 
            return index;
        } else {
            return 0;
        }
    }

    function addCompanies(bytes32[] names, uint256[] performances, bytes32[] logoUrls, uint256 count) public onlyOwner {
        for (uint256 i = 0;i < count;i++) {
            TopCompany memory c = TopCompany(names[i], performances[i], logoUrls[i]);
            companies.push(c);
            bytes32 nameLowercase = utils.lowerCase(names[i]);
            companiesIndex[nameLowercase] = companyCount + i;
        }
        companyCount += count;
    }
}