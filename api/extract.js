// kuromojiライブラリを読み込む
const kuromoji = require('kuromoji');

// kuromojiの辞書（単語帳）の場所を指定
const DIC_PATH = 'node_modules/kuromoji/dict';

// kuromojiの初期化（キャッシュ）
let tokenizer = null;
const getTokenizer = () => {
  return new Promise((resolve, reject) => {
    // 既に初期化済みなら、それを返す
    if (tokenizer) {
      return resolve(tokenizer);
    }
    // まだなら、新しく作る
    kuromoji.builder({ dicPath: DIC_PATH }).build((err, k) => {
      if (err) {
        return reject(err);
      }
      tokenizer = k; // 作ったものをキャッシュする
      resolve(tokenizer);
    });
  });
};

// Vercelが実行するメインの関数
export default async (req, res) => {
  // --- CORS設定 (n8n Cloudからのアクセスを許可) ---
  res.setHeader('Access-Control-Allow-Origin', '*'); // すべてのドメインを許可
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSメソッド (疎通確認) への対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- POSTメソッド以外のリクエストは拒否 ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- メインのキーワード抽出処理 ---
  try {
    // 1. n8nから送られてきたJSON ({"question": "..."}) を取り出す
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Missing "question" in body' });
    }

    // 2. kuromojiの準備が整うのを待つ
    const tokenizer = await getTokenizer();

    // 3. 質問文を単語に分割
    const path = tokenizer.tokenize(question);

    // 4. 名詞だけを抜き出す
    const keywords = path
      .filter(token =>
        token.pos === '名詞' &&
        (token.pos_detail_1 === '一般' || token.pos_detail_1 === '固有名詞' || token.pos_detail_1 === 'サ変接続') &&
        token.surface_form.length > 1
      )
      .map(token => token.surface_form)
      .filter((value, index, self) => self.indexOf(value) === index); // 重複を削除

    // 5. キーワードの配列をJSONとしてn8nに返す
    return res.status(200).json({ keywords: keywords });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
