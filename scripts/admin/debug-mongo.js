const MongoStore = require('connect-mongo');
console.log('default.create:', MongoStore.default ? MongoStore.default.create : 'undefined');
console.log('MongoStore.create:', MongoStore.MongoStore ? MongoStore.MongoStore.create : 'undefined');
