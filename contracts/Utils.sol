pragma solidity ^0.4.21;

contract Utils {
    function sqrt(uint256 x) public pure returns (uint256 y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function lowerCase(bytes32 value) public pure returns (bytes32) {
        bytes32 result = value;
        for (uint i = 0; i < 32; i++) {
            if (uint(value[i]) >= 65 && uint(value[i]) <= 90) {
                result |= bytes32(0x20) << (31-i)*8;
            }
        }
        return result;
    }
    
    function validateCompanyName(bytes32 name) public pure returns (bool) {
        for (uint i = 0; i < 32; i++) {
            if (uint(name[i]) != 0 && (uint(name[i]) < 32 || uint(name[i]) > 126)) {
                return false;
            }
        }
        return true;
    }
}