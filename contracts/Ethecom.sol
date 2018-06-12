pragma solidity ^0.4.21;

import "./ECOMTokenInterface.sol";
import "./TopCompanyFactoryInterface.sol";
import "./RandomGeneratorInterface.sol";
import "./CompanyCostInterface.sol";
import "./Ownable.sol";
import "./Utils.sol";

contract Ethecom is Ownable {
    struct Company {
        bytes32 name;
        bytes32 logoUrl;
        uint performance;
        address owner;
        uint price;
        uint lastPrice;
        bool isOnsale;
    }

    event CompanyCreated(bytes32 name, bytes32 logoUrl,uint256 performance, uint256 price, address owner);
    event CompanyTransferred(bytes32 name, uint256 newPrice, address oldOwner, address owner);
    event CompanyLogoUpdated(bytes32 name, bytes32 logoUrl, address owner);
    event CompanySaleStatusChanged(bytes32 name, bool saleStatus, uint256 lastPrice, address owner);
    event SuperPrivilegeLuckyDrawResult(uint256 resultValue, bool status, address owner);

    ECOMTokenInterface public tokenContract;
    TopCompanyFactoryInterface public factoryContract;
    RandomGeneratorInterface public randContract;
    CompanyCostInterface public costContract;
    Utils private utils;
    uint ECOMDecimal = 100000000;

    // Owner can update this value
    uint256 public blocksPerDay = 5000;

    // Map company name to company object
    mapping(bytes32 => Company) public companies;

    // Total performance of all companies owned by a user
    mapping(address => uint256) public ownedPerformance;

    // The last time a user claim their ECOM token so that it will be transferred to their eth account
    mapping(address => uint256) public lastTokenClaimedBlock;

    // Number of super privileges an account has 
    mapping (address => uint256) public superPrivilegeCount;

    // Minimum random value required to get a super privilege
    uint256 public minRandomPrivilegeValue = 90;
    uint256 public superPrivilegeCost = 30; // in ECOM token

    uint256 public maxUserCreatedPerformance = 35;// Max performance of a user created company
    uint256 public oldOwnerProfit = 80;
    uint256 public logoFee = 10; // In ECOM
    uint256 public minCompanyValue = 1000000000000000; // in wei
    uint256 public maxCompanyValue = 100000000000000000000; // in wei

    constructor(address ECOMToken, address topCompanyFactory, address randomGenerator, address companyCost) public {
        factoryContract = TopCompanyFactoryInterface(topCompanyFactory);
        randContract = RandomGeneratorInterface(randomGenerator);
        costContract = CompanyCostInterface(companyCost);
        tokenContract = ECOMTokenInterface(ECOMToken);

        utils = new Utils();
    }

    /**
     *  For configurations
     */

    function updateBlocksPerDay(uint256 value) public onlyOwner {
        blocksPerDay = value;
    }

    function updateSuperPrivilegeParams(uint256 minRandom, uint256 cost) public onlyOwner {
        minRandomPrivilegeValue = minRandom;
        superPrivilegeCost = cost;
    }

    function updateUserCreatedPerformance(uint256 max) public onlyOwner {
        maxUserCreatedPerformance = max;
    }

    function updateLogoFee(uint256 newFee) public onlyOwner {
        logoFee = newFee;
    }

    function updateOldOwnerProfit(uint256 newProfit) public onlyOwner {
        oldOwnerProfit = newProfit;
    }

    function updateMinCompanyValue(uint256 minValue) public onlyOwner {
        minCompanyValue = minValue;
    }

    /**
     * Core methods
     * ------------------------------------------------------------------------------------------
     */

    function purchaseCompany(bytes32 nameFromUser, bool superPrivilege) public payable {
        bytes32 nameLowercase = utils.lowerCase(nameFromUser);
        Company storage c = companies[nameLowercase];
        require(c.owner != address(0));
        require(c.owner != msg.sender);
        require(c.price == msg.value);
        require(c.isOnsale == true);
        if (superPrivilege) {
            require(superPrivilegeCount[msg.sender] > 0);
        }

        address oldOwner = c.owner;
        uint256 profit = c.price - c.lastPrice;
        oldOwner.transfer(c.lastPrice + profit * 8/10);

        c.owner = msg.sender;
        c.lastPrice = c.price;
        c.price = costContract.calculateNextPrice(c.price);
        
        emit CompanyTransferred(c.name, c.price, oldOwner, msg.sender);

        claimToken(oldOwner);
        ownedPerformance[oldOwner] -= c.performance;

        claimToken(msg.sender);
        ownedPerformance[msg.sender] += c.performance;

        if (superPrivilege) {
            c.isOnsale = false;
            superPrivilegeCount[msg.sender]--;
            emit CompanySaleStatusChanged(c.name, c.isOnsale, c.price, msg.sender);
        }
    }

    function purchaseTopCompany(bytes32 nameFromUser, bool superPrivilege) public payable {
        // Check for sending enough eth
        uint256 startPrice = factoryContract.startPrice();
        require(msg.value == startPrice);

        bytes32 nameLowercase = utils.lowerCase(nameFromUser);
        // uint256 index = factoryContract.companiesIndex(nameLowercase);

        // Check for company name availability
        // require(index != 0);
        require(companies[nameLowercase].owner == address(0));

        // Check if it is avaialble for purchase
        require(factoryContract.canBuyCompany(nameLowercase));
        if (superPrivilege) {
            require(superPrivilegeCount[msg.sender] > 0);
        }

        bytes32 name;
        uint256 performance;
        bytes32 logoUrl;
        (name, performance, logoUrl) = factoryContract.getCompanyByName(nameLowercase);
        uint256 price = costContract.calculateNextPrice(startPrice);
        Company memory c = Company(name, logoUrl, performance, msg.sender, price, startPrice, !superPrivilege);
        companies[nameLowercase] = c;

        claimToken(msg.sender);
        ownedPerformance[msg.sender] += performance;

        factoryContract.removeCompany(nameLowercase);
        //emit CompanyCreated(name, logoUrl, performance, price, msg.sender);
        emit CompanyTransferred(name, price, address(0), msg.sender);

        if (superPrivilege) {
            superPrivilegeCount[msg.sender]--;
            emit CompanySaleStatusChanged(c.name, c.isOnsale, c.price, msg.sender);
        }
    }

    // Anyone with enough ECOM token can create a company
    // Companies are unique by name
    // User can set the inital value for their company (without knowing it performance)
    // Newly created company will be put on sale immediately
    function createCompany(bytes32 name, bytes32 logoUrl, uint256 value) public {
        require(value >= minCompanyValue);
        require(value <= maxCompanyValue);
        require(utils.validateCompanyName(name) == true);

        bytes32 nameLowercase = utils.lowerCase(name);

        // If company doesn't exists, owner address will be address 0
        require(factoryContract.companiesIndex(nameLowercase) == 0);
        require(companies[nameLowercase].owner == address(0));

        uint256 cost = costContract.getCreationCost() * ECOMDecimal;
        claimToken(msg.sender);
        transferECOMTokenToContract(cost);

        uint256 performance = generateRandomPerformance();
        Company memory c = Company(name, logoUrl, performance, msg.sender, value, costContract.calculatePreviousPrice(value), true);
        companies[nameLowercase] = c;

        ownedPerformance[msg.sender] += performance;

        costContract.increaseCompanyCountByOne();
        emit CompanyCreated(name, logoUrl, performance, value, msg.sender);
    }

    // Use 1 super privilege to permanently own a company
    function permanentlyOwnMyCompany(bytes32 nameFromUser) public {
        bytes32 nameLowercase = utils.lowerCase(nameFromUser);
        Company storage c = companies[nameLowercase];
        require(superPrivilegeCount[msg.sender] > 0);
        require(c.owner != address(0));
        require(c.owner == msg.sender);
        require(c.isOnsale == true);
        
        c.isOnsale = false;
        superPrivilegeCount[msg.sender]--;

        emit CompanySaleStatusChanged(c.name, false, c.price, msg.sender);
    }

    // Put a permanently owned company on sale again
    function putCompanyOnsale(bytes32 nameFromUser, uint256 startPrice) public {
        require(startPrice >= minCompanyValue);
        require(startPrice <= maxCompanyValue);
        bytes32 nameLowercase = utils.lowerCase(nameFromUser);
        Company storage c = companies[nameLowercase];
        require(c.owner != address(0));
        require(c.owner == msg.sender);
        require(c.isOnsale == false);

        c.price = startPrice;
        c.lastPrice = costContract.calculatePreviousPrice(c.price);
        c.isOnsale = true;

        emit CompanySaleStatusChanged(c.name, c.isOnsale, c.price, msg.sender);
    }

    // Anyone can call to this method to try to get a super privileged
    function runSuperPrivilegeLuckyDraw() public {
        claimToken(msg.sender);
        transferECOMTokenToContract(superPrivilegeCost*ECOMDecimal);
        uint256 rand = randContract.rand(msg.sender);
        rand = rand % 100;
        bool status = false;
        if (rand >= minRandomPrivilegeValue) {
            superPrivilegeCount[msg.sender] = superPrivilegeCount[msg.sender] + 1;
            status = true;
        }

        emit SuperPrivilegeLuckyDrawResult(rand, status, msg.sender);
    }

    // Anyone who owned some companies can claim their token
    function claimMyToken() public {
        require(ownedPerformance[msg.sender] > 0);

        claimToken(msg.sender);
    }

    function updateLogoUrl(bytes32 companyName, bytes32 logoUrl) public {
        bytes32 nameLowercase = utils.lowerCase(companyName);
        Company storage c = companies[nameLowercase];
        require(c.owner == msg.sender);
        claimToken(msg.sender);
        transferECOMTokenToContract(logoFee * ECOMDecimal);
        c.logoUrl = logoUrl;
        emit CompanyLogoUpdated(c.name, c.logoUrl, msg.sender);
    }

    /**
     * End core methods
     * ------------------------------------------------------------------------------------------
     */

     /**
     *  For migration
     */

    function updateTokenContract(address addr) public onlyOwner {
        tokenContract = ECOMTokenInterface(addr);
    }

    function updateRandContract(address addr) public onlyOwner {
        randContract = RandomGeneratorInterface(addr);
    }

    function updateCostContract(address addr) public onlyOwner {
        costContract = CompanyCostInterface(addr);
    }

    function updateFactoryContract(address addr) public onlyOwner {
        factoryContract = TopCompanyFactoryInterface(addr);
    }

    function transferSubcontractsOwnership(address addr) public onlyOwner {
        tokenContract.transferOwnership(addr);
        costContract.transferOwnership(addr);
        factoryContract.transferOwnership(addr);

        // Random generator contract doesn't need to be transferred
    }

    /**
     * For owner
     */
    function withdraw(uint256 amount) public onlyOwner {
        if (amount == 0) {
            owner.transfer(address(this).balance);
        } else {
            owner.transfer(amount);
        }
    }

    /**
     * View methods
     */

    function getTopCompanyStartPrice() public view returns (uint256) {
        return factoryContract.startPrice();
    }

    function getTopCompanyStartBlock() public view returns (int256) {
        return factoryContract.startBlock();
    }

    function getTopCompanyBlocksInBetween() public view returns (uint256) {
        return factoryContract.blocksBetweenNewCompany();
    }

    function getTopCompanyCount() public view returns (uint256) {
        return factoryContract.companyCount();
    }

    function getTopCompanyAtIndex(uint256 index) public view returns (bytes32 name, uint256 performance, bytes32 logoUrl) {
        return factoryContract.getCompany(index);
    }

    function getCompanyCreationCost() public view returns (uint256) {
        return costContract.getCreationCost();
    }

    function checkCompanyNameAvailability(bytes32 name) public view returns (uint256) {
        uint256 result = 1;
        bytes32 nameLowercase = utils.lowerCase(name);
        if (utils.validateCompanyName(name) != true) {
            result = 0;
        } else if (factoryContract.companiesIndex(nameLowercase) != 0) {
            result = 0;
        } else if (companies[nameLowercase].owner != address(0)) {
            result = 0;
        }
        return result;
    }

    // Private methods
    function transferECOMTokenToContract(uint256 amount) private {
        require(tokenContract.balanceOf(msg.sender) >= amount);
        tokenContract.ownerApprove(msg.sender, amount);
        tokenContract.transferFrom(msg.sender, address(this), amount);
    }

    function generateRandomPerformance() private returns (uint256) {
        uint256 rand = randContract.rand(msg.sender);
        rand = rand % (maxUserCreatedPerformance * maxUserCreatedPerformance);
        rand = utils.sqrt(rand);
        return maxUserCreatedPerformance - rand;
    }

    function claimToken(address receiver) private {
        uint256 numBlock = block.number - lastTokenClaimedBlock[receiver];
        uint256 profitPerBlock = ownedPerformance[receiver] * ECOMDecimal / blocksPerDay;
        uint256 profit = numBlock * profitPerBlock;
        if (profit > 0) {
            tokenContract.transfer(receiver, profit);
        }
        lastTokenClaimedBlock[receiver] = block.number;
    }
}