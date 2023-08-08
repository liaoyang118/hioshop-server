import md5 from 'js-md5';

const rp = require('request-promise');
const _ = require('lodash');
const Base64 = require('js-base64').Base64;
module.exports = class extends think.Service {
    async queryExpress(shipperCode, logisticCode, orderCode = '') {
        // 最终得到的数据，初始化
        let expressInfo = {
            success: false,
            shipperCode: shipperCode,
            shipperName: '',
            logisticCode: logisticCode,
            isFinish: 0,
            traces: []
        };
        // 要post的数据，进行编码，签名
        const fromData = this.generateFromData(shipperCode, logisticCode, orderCode);
        if (think.isEmpty(fromData)) {
            return expressInfo;
        }
        // post的参数
        const sendOptions = {
            method: 'POST',
            url: think.config('express.request_url'),
            headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            },
            form: fromData
        };
        // post请求
        try {
            const requestResult = await rp(sendOptions);
            if (think.isEmpty(requestResult)) {
                return expressInfo;
            }
            expressInfo = this.parseExpressResult(requestResult);
            expressInfo.shipperCode = shipperCode;
            expressInfo.logisticCode = logisticCode;
            return expressInfo;
        } catch (err) {
            return expressInfo;
        }
    }
    // 快递物流信息请求系统级参数 要post的数据，进行编码，签名
    generateFromData(shipperCode, logisticCode, orderCode) {
        const requestData = this.generateRequestData(shipperCode, logisticCode, orderCode);
        const fromData = {
            RequestData: encodeURI(requestData), // 把字符串作为 URI 进行编码
            EBusinessID: think.config('express.appid'), // 客户号
            RequestType: '1002', // 请求代码
            DataSign: this.generateDataSign(requestData), // 签名
            DataType: '2' //数据类型：2
        };
        return fromData;
    }
    // JavaScript 值转换为 JSON 字符串。
    generateRequestData(shipperCode, logisticCode, orderCode = '') {
        // 参数验证
        const requestData = {
            OrderCode: orderCode,
            ShipperCode: shipperCode,
            LogisticCode: logisticCode
        };
        return JSON.stringify(requestData);
    }
    // 编码加密
    generateDataSign(requestData) {
        return encodeURI(Buffer.from(think.md5(requestData + think.config('express.appkey'))).toString('base64'));
    }
    parseExpressResult(requestResult) {
        const expressInfo = {
            success: false,
            shipperCode: '',
            shipperName: '',
            logisticCode: '',
            isFinish: 0,
            traces: []
        };
        if (think.isEmpty(requestResult)) {
            return expressInfo;
        }
        try {
            if (_.isString(requestResult)) {
                requestResult = JSON.parse(requestResult); // 将一个 JSON 字符串转换为对象。
            }
        } catch (err) {
            return expressInfo;
        }
        if (think.isEmpty(requestResult.Success)) {
            return expressInfo;
        }
        // 判断是否已签收
        if (Number.parseInt(requestResult.State) === 3) {
            expressInfo.isFinish = 1;
        }
        expressInfo.success = true;
        if (!think.isEmpty(requestResult.Traces) && Array.isArray(requestResult.Traces)) {
            expressInfo.traces = _.map(requestResult.Traces, item => {
                return {
                    datetime: item.AcceptTime,
                    content: item.AcceptStation
                };
            });
            _.reverse(expressInfo.traces);
        }
        return expressInfo;
    }
    //************** 极兔 START************/
    //极兔下单
    async jituExpress(data = {}) {

        // 从前台传过来的数据
        let expressInfo = data;

        //body消息签名
        let digest = this.jituBodySign();
        data.digest = digest;
        data.customerCode = think.config('jitu.customerCode');

        // 编码
        const fromData = this.jituFromData(data);
        if (think.isEmpty(fromData)) {
            return expressInfo;
        }
        let timestamp = Date.now();

        //请求头签名
        let header_digest = this.jituHeaderSign(data);
        let _url = think.config('jitu.orderUrl');
        // 请求的参数设置
        const sendOptions = {
            method: 'POST',
            url: _url,
            headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                'apiAccount': think.config('jitu.apiAccount'),
                'digest': header_digest,
                'timestamp': timestamp
            },
            form: fromData
        };
        // post请求
        //console.log(fromData);

        try {
            const requestResult = await rp(sendOptions);
            if (think.isEmpty(requestResult)) {
                return expressInfo;
            }
            expressInfo = this.parseMianExpressResult(requestResult);
            if (expressInfo.code == '1') {
                //获取电子面单
                let mian = await this.jituDianZiMianDan(expressInfo.data.billCode);
                console.log('********');
                console.log(mian);
                if (mian.code == '1') {
                    expressInfo.mian = mian.data;
                }
            }

            return expressInfo;
        } catch (err) {
            console.log(err);
            return expressInfo;
        }
    }

    //转换表单数据
    jituFromData(data) {
        const requestData = JSON.stringify(data); // data：post进来的 // JavaScript 值转换为 JSON 字符串。
        const fromData = {
            bizContent: requestData //encodeURI(requestData)
        };
        return fromData;
    }

    //消息体签名，Base64(Md5(客户编号+密文+privateKey))，其中密文：MD5(明文密码+jadada236t2) 后大写
    jituBodySign() {

        let customerCode = think.config('jitu.customerCode');
        let pwd = think.md5(think.config('jitu.customerPwd') + 'jadada236t2').toUpperCase();
        let privatekey = think.config('jitu.privateKey');
        let str = customerCode + pwd + privatekey;
        console.log('str:' + str);

        let by = md5.digest(str);
        let b64 = Base64.encode(by);
        console.log('b64:' + b64);
        return b64;
    }

    //消息体签名，Base64(Md5(客户编号+密文+privateKey))，其中密文：MD5(明文密码+jadada236t2) 后大写
    jituHeaderSign(data) {
        let privatekey = think.config('jitu.privateKey');

        let str = JSON.stringify(data) + privatekey;
        let by = md5.digest(str);//byte[]
        let b64 = Base64.encode(by);
        console.log('headerSign:' + b64);
        return b64;
    }

    //极兔电子面单
    async jituDianZiMianDan(billCode) {
        let result = {};
        let data = {
            billCode: billCode,
            customerCode: think.config('jitu.customerCode'),
            isPrivacyFlag: true,
            noodleSpecification: 1,// 1：76*130mm
        }
        console.log('%%%%%%%%');
        console.log(data);
        // 进行form编码
        const fromData = this.jituFromData(data);
        if (think.isEmpty(fromData)) {
            return result;
        }

        let timestamp = Date.now();
        //请求头签名
        let header_digest = this.jituHeaderSign(data);

        // 请求的参数设置
        const sendOptions = {
            method: 'POST',
            url: think.config('jitu.printOrderUrl'),
            headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                'apiAccount': think.config('jitu.apiAccount'),
                'digest': header_digest,
                'timestamp': timestamp
            },
            form: fromData
        };
        // post请求
        try {
            const requestResult = await rp(sendOptions);
            if (think.isEmpty(requestResult)) {
                return result;
            }
            result = this.parseMianExpressResult(requestResult);
            if (result.code != '1') {
                return result;
            }
            return result;
        } catch (err) {
            console.log(err);
            return result;
        }
    }

    //************** 极兔 END ************/



    // 电子面单开始
    async mianExpress(data = {}) {

        console.log('====>api express<========')

        // 从前台传过来的数据
        let expressInfo = data;
        // 进行编码，签名
        const fromData = this.mianFromData(data);
        if (think.isEmpty(fromData)) {
            return expressInfo;
        }
        // 请求的参数设置
        const sendOptions = {
            method: 'POST',
            url: think.config('mianexpress.request_url'),
            headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            },
            form: fromData
        };
        // post请求
        try {
            const requestResult = await rp(sendOptions);
            if (think.isEmpty(requestResult)) {
                return expressInfo;
            }
            expressInfo = this.parseMianExpressResult(requestResult);
            let htmldata = expressInfo.PrintTemplate;
            let html = htmldata.toString();
            return expressInfo;
        } catch (err) {
            return expressInfo;
        }
    }
    // 电子面单信息请求系统级参数 要post的数据 进行编码，签名
    mianFromData(data) {
        const requestData = JSON.stringify(data); // data：post进来的 // JavaScript 值转换为 JSON 字符串。
        const fromData = {
            RequestData: encodeURI(requestData),
            EBusinessID: think.config('mianexpress.appid'),
            RequestType: '1007',
            DataSign: this.mianDataSign(requestData),
            DataType: '2'
        };
        // console.log('fromdata======');
        return fromData;
    }
    // 加密签名
    mianDataSign(requestData) {
        return encodeURI(Buffer.from(think.md5(requestData + think.config('mianexpress.appkey'))).toString('base64'));
    }
    // 返回数据
    parseMianExpressResult(requestResult) {
        const expressInfo = {
            success: false,
        };
        if (think.isEmpty(requestResult)) {
            return expressInfo;
        }
        try {
            if (_.isString(requestResult)) {
                requestResult = JSON.parse(requestResult);
            }
            return requestResult;
        } catch (err) {
            return expressInfo;
        }
        return expressInfo;
    }
    // 电子面单结束
    // 批量打印开始
    // build_form();
    /**
     * 组装POST表单用于调用快递鸟批量打印接口页面
     */
    async buildForm(data = {}) {
        let requestData = data;
        requestData = '[{"OrderCode":"234351215333113311353","PortName":"打印机名称一"}]';
        //OrderCode:需要打印的订单号，和调用快递鸟电子面单的订单号一致，PortName：本地打印机名称，请参考使用手册设置打印机名称。支持多打印机同时打印。
        // $request_data = '[{"OrderCode":"234351215333113311353","PortName":"打印机名称一"},{"OrderCode":"234351215333113311354","PortName":"打印机名称二"}]';
        let requestDataEncode = encodeURI(requestData);
        let APIKey = think.config('mianexpress.appkey');
        let API_URL = think.config('mianexpress.print_url');
        let dataSign = this.printDataSign(this.get_ip(), requestDataEncode);
        //是否预览，0-不预览 1-预览
        let is_priview = '0';
        let EBusinessID = think.config('mianexpress.appid');
        //组装表单
        let form = '<form id="form1" method="POST" action="' + API_URL + '"><input type="text" name="RequestData" value="' + requestData + '"/><input type="text" name="EBusinessID" value="' + EBusinessID + '"/><input type="text" name="DataSign" value="' + dataSign + '"/><input type="text" name="IsPriview" value="' + is_priview + '"/></form><script>form1.submit();</script>';
        console.log(form);
        return form;
    }
    // 加密签名
    printDataSign(ip, requestData) {
        return encodeURI(Buffer.from(ip + think.md5(requestData + think.config('mianexpress.appkey'))).toString('base64'));
    }
    /**
     * 判断是否为内网IP
     * @param ip IP
     * @return 是否内网IP
     */
    // function is_private_ip($ip) {
    //     return !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    // }
    /**
     * 获取客户端IP(非用户服务器IP)
     * @return 客户端IP
     */
    async get_ip() {
        const sendOptions = {
            method: 'GET',
            url: think.config('mianexpress.ip_server_url'),
            headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
        };
        // post请求
        try {
            const requestResult = await rp(sendOptions);
            if (think.isEmpty(requestResult)) {
                let i = 0
                return i;
            }
            var ip = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
            var text = ip.exec(requestResult);
            console.log(text[0]);
            return text[0];
        } catch (err) {
            return 0;
        }
    }
    // 批量打印结束
};