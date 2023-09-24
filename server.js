import * as dotenv from "dotenv";
dotenv.config();
import { ElectrumClient } from "electrum-cash";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import requestIp from "request-ip";
import { Config, Wallet, TokenMintRequest, NFTCapability, OpReturnData } from "mainnet-js";

Config.EnforceCashTokenReceiptAddresses = true;
Config.DefaultParentDerivationPath = "m/44'/145'/0'/0/0";

const app = express();
app.use(helmet());
app.set("trust proxy", 1);
app.use(requestIp.mw());

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 2,
    keyGenerator: function (req, res) {
        return req.clientIp
    },
    message: "Too many requests, please try again after 5 minutes",
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const electrum = new ElectrumClient(
    "Rostrum 7.0",
    "1.4.3",
    "rostrum.nexa.ink",
    50004,
    "wss"
  );
  
await electrum.connect();

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

const tokenId = "b988d32664826bf77a5f77a3fdd6034477141c86a9a564040e4e33a4249f5af2"; //Ghostwriter NFT
const nftsList = await electrum.request("token.nft.list", tokenId);
const ghostwriterAddress = "bitcoincash:qq4kw0pwx6upd4czkzpl3jp8vnhw35x7msjtnaszds";
const history = await electrum.request("blockchain.address.get_history", ghostwriterAddress);

app.get("/", function (req, res) {
    res.render("index", { content: null, txIds: null, commitments: null, error: null });
});

app.get("/api", function (req, res) {
    res.send(nftsList.nft);
});

app.get("/tx", function (req, res) {
    res.send(history);
});

//app.get("/api/:commitment", (req, res) => {
//if (req.params.commitment) {
    //const found = nfts.find((item) =>
    //item.name.toLowerCase() === req.params.commitment.toLowerCase()
    //);
    //if (found) {
    //res.send(found);
    //} else {
    //res.send("No commitment found.");
    //}
//}
//});

app.post("/", apiLimiter, async function (req, res) {
    const wif = process.env.WIF;
    const wallet = await Wallet.fromWIF(wif);
    let userAddress = req.body.userAddress;
    let nftCommitment = req.body.nftCommitment;
    let encoded = Buffer.from(nftCommitment).toString("hex");
    //console.log(encoded);
    let commitmentNft = encoded;
    if (nftCommitment =! req.body.nftCommitment) {
        res.render("index", { content: null, txIds: null, commitments: null, error: "You need to write something. Commitment can`t be empty." });
        return; 
    }

    let message = req.body.opreturnmessage;
    let opmessage = Buffer.from(message).toString();
    if (message =! req.body.opreturnmessage) {
        res.render("index", { content: null, txIds: null, commitments: null, error: "You need to write something. Op_return can`t be empty." });
        return; 
    }
    let chunks = ["NFT", "Ghostwriter", commitmentNft, opmessage];
    let opreturnData = OpReturnData.fromArray(chunks);

    if (userAddress = req.body.userAddress, nftCommitment = req.body.nftCommitment, message = req.body.opreturnmessage) {
        try {
        let { txId } = await wallet.tokenMint(
            tokenId,
            [
            new TokenMintRequest({
                cashaddr: userAddress,
                commitment: commitmentNft,
                capability: NFTCapability.none,
                value: 800,
            })
            ],
            await wallet.send([ opreturnData ])
        );
        res.render("index", {
            content: "Done. You minted GHOSTWRITER NFT",
            txIds: txId,
            commitments: null,
            error: null
        }); 
        } catch (e) {
            //console.log("Not enough funds");
            res.render("index", {
                content: null,
                txIds: null,
                commitments: null,
                error: "Not enough funds to mint NFT or commitment/message is too long. Try again"
            }); 
        }
    }
});

app.listen(process.env.PORT, () => {
    console.log("Server listening on port " + process.env.PORT + "!");
});