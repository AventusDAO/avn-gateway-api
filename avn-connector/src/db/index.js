const config = require('multiconfig').load();
const typeorm = require("typeorm");

async function init() {
  const dataSource = new typeorm.DataSource({
    type: "postgres",
    host: config.postgress.host,
    port: config.postgress.port,
    username: config.postgress.username,
    password: config.postgress.password,
    database: config.postgress.database,
    synchronize: config.postgress.synchronize,
    entities: [
      require("./entity/payer"),
      require("./entity/splitFeeUser"),
      require("./entity/transaction"),
      require("./entity/payerTransaction")
    ],
  });

  await dataSource.initialize();

  return dataSource;
}

module.exports = {
  init,
};
