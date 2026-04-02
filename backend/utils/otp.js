const otpGenerator = require('otp-generator');

const generateOTP = () => {
  return otpGenerator.generate(6, { 
    upperCaseAlphabets: false, 
    specialChars: false, 
    lowerCaseAlphabets: false 
  });
};

const sendOTP = async (type, target, otp) => {
  // Simulation: Log to console in development
  console.log(`[SIMULATION] Sending ${otp} to ${type}: ${target}`);
  return true;
};

module.exports = { generateOTP, sendOTP };
