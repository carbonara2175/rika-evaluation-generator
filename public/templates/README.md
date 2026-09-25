# Word出力テンプレート

Word出力機能を利用するには、次のテンプレートをこのディレクトリへ手動で配置してください。

- ファイル名：`unit-plan-template.docx`
- 配置場所：`public/templates/unit-plan-template.docx`
- 用途：単元指導計画のWord出力テンプレート

テンプレート本体（`.docx`）は、このリポジトリの変更差分には含めていません。テンプレートが存在しない場合、画面上に「Wordテンプレートを読み込めませんでした」と表示され、ほかの機能は引き続き利用できます。

## テンプレートで使用できるデータ

docxtemplaterのタグとして、科目名 `{subject}`、単元名 `{unit}`、配当時数 `{allocatedHours}` を使用できます。さらに、`goals`、`criteria`、`lessons` の各配列をループとして使用できます。

- `goals`：`number`、`text`
- `criteria`：`key`、`heading`、`text`
- `lessons`：`hour`、`activity`、`knowledge`、`thinking`、`attitude`、`method`
