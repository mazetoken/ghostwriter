import * as dotenv from "dotenv";
dotenv.config();
import express from "express";
import helmet from "helmet";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
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

app.use(express.static("public"));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.get("/", function (req, res) {
    res.render("index", { content: null, txIds: null, image: null, error: null });
});

app.post("/", apiLimiter, async function (req, res) {
    const wif = process.env.WIF;
    const wallet = await Wallet.fromWIF(wif);
    let userAddress = req.body.userAddress;
    const tokenId1 = "b988d32664826bf77a5f77a3fdd6034477141c86a9a564040e4e33a4249f5af2"; //Ghostwriter NFT
    let nftCommitment = req.body.nftCommitment;
    let encoded = Buffer.from(nftCommitment).toString("hex");
    //console.log(encoded);
    let commitmentNft = encoded;
    if (nftCommitment =! req.body.nftCommitment) {
        res.render("index", { content: null, txIds: null, image: null, error: "You need to write something" });
        return; 
    }

    //let message = req.body.opreturnmessage;
    //let chunks = ["GHOST", message];
    //let opreturnData = OpReturnData.fromArray(chunks);
    //let opreturnData = OpReturnData.from(message);

    if (userAddress = req.body.userAddress, nftCommitment = req.body.nftCommitment) {
        try {
        const { txId } = await wallet.tokenMint(
            tokenId1,
            [
            new TokenMintRequest({
                cashaddr: userAddress,
                commitment: commitmentNft,
                capability: NFTCapability.none,
                value: 800
            }),
            //opreturnData
            ]
        )

        res.render("index", {
            content: "Done. You minted the NFT",
            txIds: txId,
            error: null
        }); 
        } catch (e) {
            //console.log("Not enough funds");
            res.render("index", {
                content: null,
                txIds: null,
                error: "Not enough funds to mint NFT or text is too long. Try again"
            }); 
        }
    }
});

app.listen(process.env.PORT, () => {
    console.log("Server listening on port " + process.env.PORT + "!");
});