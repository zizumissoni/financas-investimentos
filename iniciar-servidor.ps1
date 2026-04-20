$caminho = "C:\Users\zizu_\OneDrive\Área de Trabalho\PROJETOS CLAUD CODE - GIOVANI\Finanças Pessoas e Investimentos\financas-investimentos"
$npm = "C:\Program Files\nodejs\npm.cmd"

Start-Process -FilePath $npm `
  -ArgumentList "run", "dev" `
  -WorkingDirectory $caminho `
  -WindowStyle Hidden
