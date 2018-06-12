pragma solidity ^0.4.21;

import "./Ownable.sol";

contract CompanyCostInterface is Ownable {
    function getCreationCost() public view returns (uint256); // in ECOM without decimals
    function getCompanyCount() public view returns (uint256);
    function getOffsaleCount() public view returns (uint256);
    function increaseCompanyCountByOne() public;
    function increaseOffsaleCountByOne() public;
    function decreaseOffsaleCountByOne() public;

    function calculateNextPrice(uint256 oldPrice) public view returns (uint256);
    function calculatePreviousPrice(uint256 newPrice) public view returns (uint256);
}