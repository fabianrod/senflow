const { execFileSync, spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const readline = require("node:readline");
const os = require("node:os");
const path = require("node:path");

const CLI_NAME = "senflow";
const MIN_NODE_VERSION = "20.11.0";
const MIN_NPM_VERSION = "10.2.0";
const COMMANDS = new Set(["install", "run", "uninstall"]);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function info(message) {
  console.log(`[${CLI_NAME}] ${message}`);
}

function error(message) {
  console.error(`[${CLI_NAME}:error] ${message}`);
}

function runCommand(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
}

function hasPackageJson(dirPath) {
  return fs.existsSync(path.join(dirPath, "package.json"));
}

function getAppDir() {
  const envAppDir = process.env.SENFLOW_APP_DIR;
  if (envAppDir && hasPackageJson(envAppDir)) {
    return envAppDir;
  }

  const currentDir = process.cwd();
  if (hasPackageJson(currentDir)) {
    return currentDir;
  }

  if (hasPackageJson(PROJECT_ROOT)) {
    return PROJECT_ROOT;
  }

  throw new Error(
    "No se encontro una instalacion de SenFlow valida (package.json). Ejecuta 'senflow install'.",
  );
}

function getSenflowPaths() {
  const homeDir = os.homedir();
  const senflowHome = process.env.SENFLOW_HOME || path.join(homeDir, ".senflow");
  const appDir = process.env.SENFLOW_APP_DIR || path.join(senflowHome, "app");
  const binDir = process.env.SENFLOW_BIN_DIR || path.join(homeDir, ".local", "bin");
  const launcherPath = path.join(binDir, "senflow");
  const preservedDataDir = path.join(senflowHome, "data");

  return {
    senflowHome,
    appDir,
    launcherPath,
    preservedDataDir,
  };
}

function readEnvMap(fileContent) {
  const entries = new Map();
  const lines = fileContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries.set(key, value);
  }

  return entries;
}

function upsertEnvVariable(fileContent, key, rawValue) {
  const lines = fileContent.split(/\r?\n/);
  const variablePattern = new RegExp(`^\\s*${key}\\s*=`);
  const newLine = `${key}="${rawValue}"`;
  let replaced = false;

  const updatedLines = lines.map((line) => {
    if (variablePattern.test(line)) {
      replaced = true;
      return newLine;
    }
    return line;
  });

  if (!replaced) {
    if (updatedLines.length > 0 && updatedLines.at(-1) !== "") {
      updatedLines.push("");
    }
    updatedLines.push(newLine);
  }

  return updatedLines.join("\n");
}

function ensureEnvFile(appDir) {
  const envPath = path.join(appDir, ".env");
  const envExamplePath = path.join(appDir, ".env.example");

  if (!fs.existsSync(envPath)) {
    if (!fs.existsSync(envExamplePath)) {
      throw new Error("No existe .env ni .env.example para bootstrap de entorno.");
    }
    fs.copyFileSync(envExamplePath, envPath);
    info("Se creo .env desde .env.example.");
  }

  let envContent = fs.readFileSync(envPath, "utf8");
  const envMap = readEnvMap(envContent);

  envContent = upsertEnvVariable(envContent, "DATABASE_URL", "file:./data/app.db");

  const secretValue = envMap.get("AUTH_SESSION_SECRET");
  const hasPlaceholderSecret =
    !secretValue || secretValue.includes("define-un-secreto-largo-en-local");

  if (hasPlaceholderSecret) {
    const generatedSecret = crypto.randomBytes(32).toString("hex");
    envContent = upsertEnvVariable(
      envContent,
      "AUTH_SESSION_SECRET",
      generatedSecret,
    );
    info("Se genero AUTH_SESSION_SECRET automaticamente.");
  }

  fs.writeFileSync(envPath, envContent.endsWith("\n") ? envContent : `${envContent}\n`);
  info("Variables de entorno listas.");
}

function ensureDataDirectory(appDir) {
  const dataDir = path.join(appDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  info("Directorio data/ verificado.");
}

function getServerUrl() {
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

function canSkipInstall(appDir) {
  const nodeModulesPath = path.join(appDir, "node_modules");
  const envPath = path.join(appDir, ".env");
  const dataDir = path.join(appDir, "data");
  const dbPath = path.join(dataDir, "app.db");

  return (
    fs.existsSync(nodeModulesPath) &&
    fs.existsSync(envPath) &&
    fs.existsSync(dataDir) &&
    fs.existsSync(dbPath)
  );
}

function hasProductionBuild(appDir) {
  const buildIdPath = path.join(appDir, ".next", "BUILD_ID");
  return fs.existsSync(buildIdPath);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function checkHealth(url) {
  return new Promise((resolve) => {
    const request = http.get(`${url}/api/health`, (response) => {
      resolve(response.statusCode && response.statusCode >= 200 && response.statusCode < 500);
      response.resume();
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1200, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const isHealthy = await checkHealth(url);
    if (isHealthy) return true;
    // eslint-disable-next-line no-await-in-loop
    await wait(750);
  }
  return false;
}

function openBrowser(url) {
  if (process.env.SENFLOW_DISABLE_BROWSER === "1") {
    info("Apertura de navegador desactivada por SENFLOW_DISABLE_BROWSER=1.");
    return;
  }

  const platform = os.platform();
  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    return;
  }

  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    return;
  }

  spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function parseVersion(version) {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  return [Number(major), Number(minor), Number(patch)];
}

function isVersionAtLeast(current, minimum) {
  const currentParts = parseVersion(current);
  const minimumParts = parseVersion(minimum);

  for (let i = 0; i < 3; i += 1) {
    if (currentParts[i] > minimumParts[i]) return true;
    if (currentParts[i] < minimumParts[i]) return false;
  }

  return true;
}

function getCommandVersion(command, args) {
  try {
    const output = execFileSync(command, args, { encoding: "utf8" }).trim();
    return output.replace(/^v/, "");
  } catch {
    throw new Error(`No se encontro '${command}' en PATH.`);
  }
}

function validateRuntimePrerequisites() {
  const nodeVersion = getCommandVersion("node", ["--version"]);
  if (!isVersionAtLeast(nodeVersion, MIN_NODE_VERSION)) {
    throw new Error(
      `Node.js ${nodeVersion} no cumple minimo ${MIN_NODE_VERSION}.`,
    );
  }

  const npmVersion = getCommandVersion("npm", ["--version"]);
  if (!isVersionAtLeast(npmVersion, MIN_NPM_VERSION)) {
    throw new Error(`npm ${npmVersion} no cumple minimo ${MIN_NPM_VERSION}.`);
  }

  info(`Prerequisitos OK: node ${nodeVersion}, npm ${npmVersion}.`);
}

function parseUninstallArgs(args) {
  const options = {
    purge: false,
    yes: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--purge") {
      options.purge = true;
      continue;
    }
    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Opcion desconocida para uninstall: '${arg}'.`);
  }

  return options;
}

function askForConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return false;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

function printHelp() {
  console.log(
    [
      "SenFlow CLI",
      "",
      "Uso:",
      "  senflow <comando>",
      "",
      "Comandos:",
      "  install   Prepara instalacion local de SenFlow (Fase 2).",
      "  run       Ejecuta SenFlow en modo produccion (Fase 3).",
      "  uninstall Desinstala launcher y archivos locales.",
      "",
      "Opciones:",
      "  -h, --help  Muestra esta ayuda.",
    ].join("\n"),
  );
}

async function handleInstall() {
  const appDir = getAppDir();

  info(`Instalacion iniciada en ${appDir}`);
  info("Paso 1/4: instalando dependencias...");
  runCommand("npm", ["install"], appDir);

  info("Paso 2/4: preparando .env...");
  ensureEnvFile(appDir);

  info("Paso 3/4: asegurando carpeta de datos...");
  ensureDataDirectory(appDir);

  info("Paso 4/4: ejecutando Prisma (generate + migrate)...");
  runCommand("npm", ["run", "db:generate"], appDir);
  runCommand("npm", ["run", "db:migrate"], appDir);

  info("Instalacion completada. Siguiente paso: senflow run");
  return 0;
}

async function handleRun() {
  const appDir = getAppDir();

  if (!canSkipInstall(appDir)) {
    info("Setup incompleto detectado. Ejecutando 'senflow install' automaticamente...");
    await handleInstall();
  } else {
    info("Setup minimo detectado, no se requiere install.");
  }

  if (!hasProductionBuild(appDir)) {
    info("Build de produccion ausente. Ejecutando npm run build...");
    runCommand("npm", ["run", "build"], appDir);
  } else {
    info("Build de produccion detectado.");
  }

  const serverUrl = getServerUrl();
  info(`Iniciando servidor de produccion en ${serverUrl} ...`);

  const serverProcess = spawn("npm", ["run", "start"], {
    cwd: appDir,
    stdio: "inherit",
    env: process.env,
  });

  const isHealthy = await waitForHealth(serverUrl, 30000);
  if (isHealthy) {
    info("Servidor disponible. Abriendo navegador...");
    openBrowser(serverUrl);
  } else {
    error("No se confirmo healthcheck en 30s; servidor puede seguir iniciando.");
  }

  return new Promise((resolve) => {
    serverProcess.on("exit", (code) => {
      resolve(code ?? 0);
    });
  });
}

async function handleUninstall(args) {
  const options = parseUninstallArgs(args);
  if (options.help) {
    console.log(
      [
        "Uso:",
        "  senflow uninstall [--purge] [--yes]",
        "",
        "Opciones:",
        "  --purge  Elimina tambien datos persistidos en SENFLOW_HOME.",
        "  --yes    Omite confirmacion interactiva para --purge.",
      ].join("\n"),
    );
    return 0;
  }

  const { senflowHome, appDir, launcherPath, preservedDataDir } = getSenflowPaths();
  const appDataDir = path.join(appDir, "data");

  if (options.purge && !options.yes) {
    const confirmed = await askForConfirmation(
      `[${CLI_NAME}] Esto eliminara TODO en ${senflowHome}. Escribe 'yes' para continuar: `,
    );
    if (!confirmed) {
      info("Desinstalacion cancelada por el usuario.");
      return 1;
    }
  }

  const launcherRemoved = removeIfExists(launcherPath);
  if (launcherRemoved) {
    info(`Launcher eliminado: ${launcherPath}`);
  } else {
    info(`Launcher no encontrado: ${launcherPath}`);
  }

  if (options.purge) {
    const homeRemoved = removeIfExists(senflowHome);
    if (homeRemoved) {
      info(`Se elimino ${senflowHome} por completo (--purge).`);
    } else {
      info(`No se encontro ${senflowHome}; no hubo datos para purgar.`);
    }
    info("Desinstalacion completada.");
    return 0;
  }

  if (fs.existsSync(appDataDir)) {
    fs.mkdirSync(preservedDataDir, { recursive: true });
    fs.cpSync(appDataDir, preservedDataDir, { recursive: true, force: true });
    info(`Datos preservados en ${preservedDataDir}`);
  }

  const appRemoved = removeIfExists(appDir);
  if (appRemoved) {
    info(`Directorio de app eliminado: ${appDir}`);
  } else {
    info(`Directorio de app no encontrado: ${appDir}`);
  }

  info("Desinstalacion completada.");
  return 0;
}

async function runCli(argv) {
  const [command, ...commandArgs] = argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  if (!COMMANDS.has(command)) {
    error(`Comando desconocido: '${command}'. Usa 'senflow --help'.`);
    return 1;
  }

  validateRuntimePrerequisites();

  if (command === "install") {
    return handleInstall();
  }

  if (command === "uninstall") {
    return handleUninstall(commandArgs);
  }

  return handleRun();
}

module.exports = {
  runCli,
};
