module.exports = async function() {
  console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  await global.__BROWSER_GLOBAL__.close();
}
