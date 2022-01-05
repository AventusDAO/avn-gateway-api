module.exports = async ({ options, resolveVariable }) => {
  const config = await resolveVariable('sls:config')
  console.log("eee", config)
  return require('./' + config)
}
