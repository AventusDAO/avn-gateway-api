const config = require('multiconfig').load();
const typeorm = require("typeorm");

async function init() {
  const dataSource = new typeorm.DataSource({
    type: "postgres",
    host: config.postgres.host,
    port: config.postgres.port,
    username: config.postgres.username,
    password: config.postgres.password,
    database: config.postgres.database,
    synchronize: config.postgres.synchronize,
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
