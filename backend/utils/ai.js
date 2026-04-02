const classifyIssue = async (imagePath) => {
  // Simulation: Artificial delay to mimic AI processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock classification logic
  const categories = ['Road Damage', 'Garbage', 'Water Leakage', 'Street Light'];
  const randomIndex = Math.floor(Math.random() * categories.length);
  const confidence = (Math.random() * 0.3 + 0.7).toFixed(2); // 0.7 to 1.0

  return {
    category: categories[randomIndex],
    confidence,
    isDuplicate: Math.random() < 0.2 // 20% chance of being detected as duplicate
  };
};

module.exports = { classifyIssue };
