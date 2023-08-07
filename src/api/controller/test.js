const Base = require('./base.js');

import md5 from 'js-md5';
let Base64 = require('js-base64').Base64;

module.exports = class extends Base {

    async md5ByteTestAction() {

        let customerCode = 'J0086474299';
        let pwd = '6A272C3DD1F3CD2F92BF567C37040910';
        let privatekey = '0258d71b55fc45e3ad7a7f38bf4b201a';

        let str = customerCode + pwd + privatekey;
        let by = md5.digest(str);
        console.log('by:' + by);

        let b64 = Base64.encode(by);
        console.log('b64:' + b64);


        return this.success(b64);
    }
}