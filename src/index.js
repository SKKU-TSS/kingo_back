const api_config =require("./config/config.js");
const express = require("express");
const Caver = require("caver-js");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mysql = require("mysql");
const ipfsClient = require("ipfs-http-client");
const asyncify = require("express-asyncify");
const router = asyncify(express.Router());
const DEPLOYED_ABI = require("./contractinfo/deployedABI.json");
const DEPLOYED_ADDRESS = require("./contractinfo/deployedAddress.json");
// const { cav, ipfs, IPFSCONTRACT } = require("./variables");
const dbconfig = require("./config/database.js");
const connection = mysql.createConnection(dbconfig);
const schedule = require("node-schedule");

const Web3 = require("web3");
const app = express();
app.use(helmet());
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan("combined"));

app.set("port", process.env.PORT || 5000);

const web3 = new Web3("ws://some.local-or-remote.node:8546");
const config = {
  rpcURL: "https://api.baobab.klaytn.net:8651",
};


let ipfs = ipfsClient({
  host: "ipfs.infura.io",
  port: "5001",
  protocol: "https",
});

const caver = new Caver(config.rpcURL);
const IPFSCONTRACT = new caver.klay.Contract(DEPLOYED_ABI, DEPLOYED_ADDRESS);

function MetadataSchema(database) {
  return {
    title: "Transaction",
    transactions: {
      description: database,
    },
  };
}

function MetadataSchema(database) {
  return {
    title: "Transaction",
    transactions: {
      description: database,
    },
  };
}


const feePayer = caver.klay.accounts.wallet.add(
  //클레이튼 개인키로 추가해줍니다.
  "0x8cafa33df8c1740720bc4815ce7c7cd61d18aaf396bb2a3da5e197f0c7b85aff"
);



app.get("/api/uploadIpfs", async (req, res) => {
  const index = req.query.hash;
  console.log(index);
  let database;
  connection.query(
    `SELECT * from transaction where _hash=${index}`,
    async (err, rows, fields) => {
      if (err) throw err;
      database = rows;
      const transactions = MetadataSchema(database);
      const ipfsres = await ipfs.add(Buffer.from(JSON.stringify(transactions))); //ipfs에 transactions를 올립니다.
      const url = "https://ipfs.infura.io/ipfs/" + ipfsres[0].hash; // ipfs url을 형식에 맞게 초기화해줍니다.

      const { rawTransaction: senderRawTransaction } =
        await caver.klay.accounts.signTransaction({
          // 트랜잭션에 sign을 합니다.
          type: "FEE_DELEGATED_SMART_CONTRACT_EXECUTION",
          from: feePayer.address,
          to: DEPLOYED_ADDRESS,
          data: IPFSCONTRACT.methods.setIpfsAddress(index, url).encodeABI(),
          gas: "500000",
          value: caver.utils.toPeb("0", "KLAY"),
        });

      caver.klay
        .sendTransaction({
          // feepayer와 보낼 트랜잭션을 정하고 klaytn에 올립니다.
          senderRawTransaction: senderRawTransaction,
          feePayer: feePayer.address,
        })
        .then(function (receipt) {
          console.log(receipt.transactionHash); // 트랜잭션 해시가 발급됩니다.
          connection.query(
            `UPDATE TRANSACTION set _hashreceipt="${receipt.transactionHash}" where _hash=${index}`, // _hashreceipt컬럼을 _hash가 index인 row에 채웁니다.
            async (err, rows) => {
              if (err) throw err;
              res.json({ status: 200 });
            }
          );
        });
    }
  );

  // const transactions = MetadataSchema(database);

  // const ipfsres = await ipfs.add(Buffer.from(JSON.stringify(transactions)));
  // const url = "https://ipfs.infura.io/ipfs/" + ipfsres[0].hash;
});


app.get("/api/getHash", (req, res) => {
  const address = req.query.address;
  let hash = [];
  let receipt = [];
  let add = [];

  connection.query(
    `SELECT * from transaction where _to="${address}" or _from="${address}"`, // address와 관련된 모든 transaction을 찾습니다.
    (err, rows, fields) => {
      if (err) throw err;
      // 조회한 트랜잭션에서의 모든 _hash값, _hashreceipt 값을 찾고 배열 형태로 반환해줍니다.(_hash, _hashreceipt는 1대1 매칭이 됩니다.)
      // 같은 _hash에 대해서 같은 _hashreceipt 값 그 반대도 마찬가지
      for (let i = 0; i < rows.length; i++) {
        hash.push(rows[i]._hash);
        receipt.push(rows[i]._hashreceipt);
      }
      const noDuplHash = hash.filter((el, idx) => {
        return hash.indexOf(el) === idx;
      });
      const noDuplReceipt = receipt.filter((el, idx) => {
        return receipt.indexOf(el) === idx;
      });
      add.push(noDuplHash);
      add.push(noDuplReceipt);
      res.json(add);
    }
  );
});


app.get("/api/result/:index", async (req, res) => {
  // 특정 _hash값을 가질 때 어떤 ipfs url을 가지는지 블록체인에 저장된 정보로부터 조회합니다.
  // 이것도 마찬가지로 같은 _hash 값을 가질경우 같은 ipfs url을 가진다고 생각하면 됩니다.

  const index = req.params.index;

  const vari = await IPFSCONTRACT.methods.getIpfsAddress(index).call();

  res.json(vari);
});

// 기능 구현

app.get("/api/transaction", (req, res) => {
  // 특정 메타마스크 주소와 관련된 트랜잭션을 조회합니다.
  // 'all'일 경우 주소가 _from, _to 둘다 인 경우를 조회하고,
  // 'to'일 경우 주소가 _to인 경우를,
  // 'from'일 경우 주소가 _from일 경우를 조회합니다.
  if (req.query.who === "all") {
    connection.query(
      `SELECT * from transaction where _to="${req.query.address}" or _from="${req.query.address}"`,
      (err, rows, fields) => {
        if (err) throw err;
        res.json(rows);
      }
    );
  } else if (req.query.who === "to") {
    connection.query(
      `SELECT * from transaction where _to="${req.query.address}"`,
      (err, rows, fields) => {
        if (err) throw err;
        res.json(rows);
      }
    );
  } else if (req.query.who === "from") {
    connection.query(
      `SELECT * from transaction where _from = "${req.query.address}"`,
      (err, rows, fields) => {
        if (err) throw err;
        res.json(rows);
      }
    );
  } else {
    res.json({
      from: "",
      to: "",
      value: "",
      type: "",
      create_date: "",
      hash: "",
    });
  }
});

function checkApiKey(req, res, next){
  try {
    const key = req.headers.authorization;
    //const api_key = api_crypto.hashing(key); 
    if (key && key === api_config.JWT_SECRET) {
      req.decoded =req.headers.authorization;
      return next();
    }
    else{
      res.sendStatus(401);
    } 
  }
  // 인증 실패
  catch (error) {
    return res.status(401).json({
      code: 401,
      message: '유효하지 않은 토큰입니다.'
    });
  }
}

app.post("/api/createTx", checkApiKey, async (req, res) => {
  // 써드 파티에서 거래가 발생하면 db에 정보를 저장합니다.
  // 처음에는 _skkuid, _from, _to, _point, _signedTransaction을 받고
  // 매주 ipfs에 트랜잭션에 올라갈 때 _hash, _hashreceipt가 null값에서 의미있는 값으로 변경됩니다.
  // _type, _txtype은 하드코딩 해두었는데 나중에 사이트가 만들어 졌을 때, 요청을 보내는 ip 주소에 따라 _type이 결정되고, 관리자가 주는 유형의 거래, 혹은 사용자가 포인트를 소비하는 유형의 거래 등에 따라 _txtype이 결정됩니다.

  let fromPoint;
  let toPoint;

  const _skkuid = req.body._skkuid;
  const _from = req.body._from;
  const _to = req.body._to;
  const _point = req.body._point;

  const _type = "A"; // ip 주소에 따라 _type 설정해줄 것
  const _txtype = "TRANSFER"; // _txtype(단순히 포인트의 이동인지 아니면 사이트로부터 받는 것인지 등등)
  const _date = new Date();
  const _hash = null;
  const _hashreceipt = null;
  const _signedTransaction = req.body._signedTransaction;
  // _from, _to, _point에 대한 정보를 sign함. 이후에 어떤 transaction에 대하여 누가 서명했는지 알기 위해서는 transaction으로 부터 _from, _to, _point 정보를 가져와서 web3js method로 알 수 있음.

  console.log({ _from: _from, _to: _to, _point: _point });

  //서명한 사람이 누구인지를 address가 나타냄.(나중에 필요할 경우 사용하면 될 것 같음)
  const address = web3.eth.accounts.recover(
    JSON.stringify({ _from: _from, _to: _to, _point: _point }),
    _signedTransaction
  );

  // if (address != _from) {
  //   res.json({ status: "잘못된 트랜잭션입니다." });
  // }

  let sql = `INSERT INTO transaction (_skkuid, _from, _to, _point, _type, _txtype, _date, _hash, _hashreceipt, _signedTransaction) VALUES (?)`;
  let values = [
    _skkuid,
    _from,
    _to,
    _point,
    _type,
    _txtype,
    _date,
    _hash,
    _hashreceipt,
    _signedTransaction,
  ];

  connection.query(
    `SELECT _username, _point${_type} from user where _username = "${_from}" or _username="${_to}"`,
    (err, rows) => {
      if (err) throw err;
      console.log(rows);
      //db에 _from, _to가 저장되어 있지않으면 에러가 납니다.
      const variable1 = rows[0][Object.keys(rows[0])[1]];
      const variable2 = rows[1][Object.keys(rows[1])[1]];
      rows[0][Object.keys(rows[0])[0]] == _from
        ? ((fromPoint = variable1), (toPoint = variable2))
        : ((fromPoint = variable2), (toPoint = variable1));
      if (fromPoint < _point) {
        return res.json({ status: "point가 부족합니다." });
      }
      let sql1 = `UPDATE USER set _point${_type}=_point${_type}-${_point} where _username="${_from}"`;
      let sql2 = `UPDATE USER set _point${_type}=_point${_type}+${_point} where _username="${_to}"`;
      connection.query(sql1, (err, rows) => {
        if (err) throw err;
      });
      connection.query(sql2, (err, rows) => {
        if (err) throw err;
      });
      connection.query(sql, [values], (err, rows) => {
        if (err) res.json({ status: err });

        return res.json({ status: "200" });
      });
    }
  );
});


// 특정 타입에 대한 from의 포인트를 가져옴.
app.get("/api/checkPointsFrom", (req, res) => {
  // 특정 플랫폼에서의 메타마스크 주소가 가진 포인트를 봅니다.
  const type = req.query.type;
  const _from = req.query._from;
  connection.query(
    `SELECT _point${type} from user where _username = "${_from}"`,
    (err, rows) => {
      if (err) throw err;
      res.json(rows[0]);
    }
  );
});



app.get("/api/graph", (req, res) => {
  // 특정 메타마스크 주소의 graph를 봅니다.
  connection.query(
    `SELECT * from graph where _account="${req.query.id}"`,
    (err, rows, fields) => {
      if (err) throw err;
      res.json(rows);
    }
  );
});


// id에 대한 쿼리를 같이 보내면 해당 유저에 대한 정보를 가져올 수 있음.
app.get("/api/userinfo", (req, res) => {
  connection.query(
    `SELECT * from user where _username="${req.query.id}"`,
    (err, rows, fields) => {
      if (err) throw err;
      res.json(rows);
    }
  );
});


var j = schedule.scheduleJob("0 0 0 * * *", function() {
  let sql = `UPDATE graph set Today = (Select POINT FROM (Select user._pointA+user._pointB+user._pointC+user._pointD AS POINT FROM user Inner join graph ON user._username = graph._account)A)`;
  let sql1 = `UPDATE graph set Day_6 = Day_5`; 
  let sql2 = `UPDATE graph set Day_5 = Day_4`; 
  let sql3 = `UPDATE graph set Day_4 = Day_3`; 
  let sql4 = `UPDATE graph set Day_3 = Day_2`; 
  let sql5 = `UPDATE graph set Day_2 = Day_1`;
  let sql6 = `UPDATE graph set Day_1 = Today`;


  connection.query(sql1, (err, rows) => {
    if (err) throw err;
  });

  connection.query(sql2, (err, rows) => {
    if (err) throw err;
  });

  connection.query(sql3, (err, rows) => {
    if (err) throw err;
  });

  connection.query(sql4, (err, rows) => {
    if (err) throw err;
  });

  connection.query(sql5, (err, rows) => {
    if (err) throw err;
  });

  connection.query(sql6, (err, rows) => {
    if (err) throw err;
  });

  connection.query(sql, (err, rows) => {
    if (err) throw err;
  });
  console.log("매일 0시 0분");
});

app.listen(app.get("port"), () => {
  console.log("Express server listening on port " + app.get("port"));
});