const mysql = require('think-model-mysql');

module.exports = {
    handle: mysql,
    database: 'hiolabsDB',
    prefix: 'hiolabs_',
    encoding: 'utf8mb4',
    host: '150.158.51.160',
    port: '3306',
    user: 'nodeuser',
    password: '123456',
    dateStrings: true
};
