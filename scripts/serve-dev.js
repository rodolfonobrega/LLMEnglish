import { spawn, execSync } from 'child_process';
import os from 'os';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const PORT = 5173;
const RULE_NAME = "LLMEnglish-Vite-Dev-Server";

function runCommand(command, ignoreErrors = false) {
  try {
    execSync(command, { stdio: 'ignore' });
  } catch (err) {
    if (!ignoreErrors) {
      console.warn(`\n[Aviso] Falha ao executar comando de firewall.`);
      console.warn('Isso pode exigir privilégios de administrador (ou sudo).');
    }
  }
}

function openFirewall() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    console.log(`\n[Firewall] Abrindo a porta ${PORT} no Windows (talvez apareca tela de permissão)...`);
    // Usamos Start-Process com -Verb RunAs para pedir elevação de privilégio (UAC) caso não seja admin
    const cmd = `powershell -Command "Start-Process netsh -ArgumentList 'advfirewall firewall add rule name=\"${RULE_NAME}\" dir=in action=allow protocol=TCP localport=${PORT}' -Verb RunAs -Wait -WindowStyle Hidden"`;
    runCommand(cmd, true);
  } else if (platform === 'linux') {
    console.log(`\n[Firewall] Abrindo a porta ${PORT} no Linux (ufw)...`);
    runCommand(`sudo ufw allow ${PORT}/tcp`);
  } else if (platform === 'darwin') {
    console.log(`\n[MacOS] O MacOS deve tratar a permissão da porta se estiver usando o Firewall do App.`);
  } else {
    console.log(`\n[Firewall] SO não suportado para configurar firewall automaticamente.`);
  }
}

function closeFirewall() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    console.log(`\n[Firewall] Fechando porta ${PORT} no Windows...`);
    const cmd = `powershell -Command "Start-Process netsh -ArgumentList 'advfirewall firewall delete rule name=\"${RULE_NAME}\"' -Verb RunAs -Wait -WindowStyle Hidden"`;
    runCommand(cmd, true);
  } else if (platform === 'linux') {
    console.log(`\n[Firewall] Fechando porta ${PORT} no Linux (ufw)...`);
    runCommand(`sudo ufw delete allow ${PORT}/tcp`, true);
  }
}

rl.question('\nDeseja servir a aplicacao para dispositivos externos na mesma rede? (s/N): ', (answer) => {
  const ans = answer.trim().toLowerCase();
  const shouldExpose = ans === 's' || ans === 'sim' || ans === 'y' || ans === 'yes';
  
  rl.close();

  let viteArgs = [];
  if (shouldExpose) {
    viteArgs.push('--host', '0.0.0.0');
    openFirewall();
  } else {
    console.log(`\n[Info] Servindo apenas localmente (localhost).`);
  }

  console.log(`\n[Vite] Iniciando servidor de desenvolvimento...`);
  
  const isWindows = os.platform() === 'win32';
  const viteCmd = isWindows ? 'npx.cmd' : 'npx';
  
  const viteProcess = spawn(viteCmd, ['vite', ...viteArgs], {
    stdio: 'inherit',
    shell: true
  });

  let cleanupCalled = false;
  const cleanup = () => {
    if (cleanupCalled) return;
    cleanupCalled = true;
    if (shouldExpose) {
      closeFirewall();
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
  
  viteProcess.on('close', (code) => {
    cleanup();
  });
});
