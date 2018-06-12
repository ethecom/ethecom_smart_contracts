pragma solidity ^0.4.21;

import "./CompanyCostInterface.sol";

contract CompanyCost is CompanyCostInterface {
    uint256[12] costs = [4, 8, 12, 20, 30, 50, 80, 120, 200, 240, 300, 400];
    uint256[12] companyCountThresholds = [10, 50, 140, 500, 1400, 5000, 14000, 50000, 140000, 500000, 1400000, 5000000];
    uint32 costIndex = 0;

    uint256 companyCount;
    uint256 companyOffsaleCount;

    constructor() public {
        companyCount = 0;
        companyOffsaleCount = 0;
    }

    function getCreationCost() public onlyOwner view returns (uint256) {
        return costs[costIndex];
    }

    function getCompanyCount() public view returns (uint256) {
        return companyCount;
    }

    function getOffsaleCount() public view returns (uint256) {
        return companyOffsaleCount;
    }

    function increaseCompanyCountByOne() public onlyOwner {
        companyCount++;

        if (companyCount == companyCountThresholds[costIndex] && costIndex < 11) {
            costIndex++;
        }
    }

    function increaseOffsaleCountByOne() public onlyOwner {
        companyOffsaleCount++;
    }

    function decreaseOffsaleCountByOne() public onlyOwner {
        companyOffsaleCount--;
    }

    uint256[] incrementRates = [20, 16, 14, 12, 11];
    uint256[] incrementThresholds = [0.1 ether, 1 ether, 5 ether, 10 ether];

    function calculateNextPrice(uint256 oldPrice) public onlyOwner view returns (uint256) {
        uint256 rate = incrementRates[incrementRates.length - 1];
        for (uint256 i = 0; i < incrementThresholds.length; i++) {
            if (oldPrice < incrementThresholds[i]) {
                rate = incrementRates[i];
                break;
            }
        }
        return oldPrice * rate / 10;
    }

    function calculatePreviousPrice(uint256 newPrice) public onlyOwner view returns (uint256) {
        uint256 rate = incrementRates[incrementRates.length - 1];
        for (uint256 i = 0; i < incrementThresholds.length; i++) {
            if (newPrice < incrementThresholds[i] * incrementRates[i+1] / 10) {
                rate = incrementRates[i];
                break;
            }
        }
        return newPrice * 10 / rate;
    }
}