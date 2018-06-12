pragma solidity ^0.4.21;

import "./Ownable.sol";

contract TopCompanyFactoryInterface is Ownable {
    struct TopCompany {
        bytes32 name;
        uint256 performance;
        bytes32 logoUrl;
    }

    uint256 public startPrice; // First available value of a top company (In wei)
    int256 public startBlock;
    uint256 public initialAvailableCount;

    // Release a new company every 2 hours (given that a block is generated every 15 seconds)
    uint256 public blocksBetweenNewCompany;

    uint256 public companyCount;
    TopCompany[] public companies;
    mapping(bytes32 => uint256) public companiesIndex;
    function canBuyCompany(bytes32 nameLowercase) public view returns (bool);
    function getCompanyByName(bytes32 nameLowercase) public view returns (bytes32 name, uint256 performance, bytes32 logoUrl);
    function getCompany(uint256 index) public view returns (bytes32 name, uint256 performance, bytes32 logoUrl);
    function removeCompany(bytes32 nameLowercase) public returns (uint256);
}