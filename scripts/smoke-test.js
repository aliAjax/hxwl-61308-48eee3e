const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

const EXPECTED_PORT = 61308;
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000;

let serverProcess = null;
let serverType = 'preview';
let actualPort = null;

function log(message) {
  console.log(`[smoke-test] ${message}`);
}

function error(message) {
  console.error(`[smoke-test] ERROR: ${message}`);
}

function cleanup() {
  if (serverProcess) {
    log('正在停止服务器...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

function parsePortFromOutput(output) {
  const patterns = [
    /localhost:(\d+)/i,
    /http:\/\/localhost:(\d+)/i,
    /Local:.*?:(\d+)/i,
    /port\s+(\d+)/i,
    /PORT\s+(\d+)/i,
    /Port\s+(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

function startServer() {
  return new Promise((resolve, reject) => {
    log(`正在启动 ${serverType} 服务器 (期望端口 ${EXPECTED_PORT})...`);

    const command = 'npm';
    const args = ['run', serverType];

    serverProcess = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let serverReady = false;
    let startupTimeout;
    let outputBuffer = '';

    function checkReady(output) {
      if (serverReady) return;

      outputBuffer += output;

      const port = parsePortFromOutput(outputBuffer);
      if (port) {
        actualPort = port;
      }

      const hasReadySignal = output.includes('ready') ||
        output.includes('Local:') ||
        output.includes('➜  Local');

      if (hasReadySignal && actualPort) {
        serverReady = true;
        clearTimeout(startupTimeout);

        if (actualPort !== EXPECTED_PORT) {
          error(`服务器端口不匹配：期望 ${EXPECTED_PORT}，实际 ${actualPort}`);
          error('请确保端口 61308 未被占用后重试');
          reject(new Error(`Port mismatch: expected ${EXPECTED_PORT}, got ${actualPort}`));
        } else {
          log(`服务器已启动，端口: ${actualPort}`);
          resolve();
        }
      }
    }

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(`[${serverType}] ${output}`);
      checkReady(output);
    });

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(`[${serverType}-err] ${output}`);
      checkReady(output);
    });

    serverProcess.on('error', (err) => {
      error(`启动服务器失败: ${err.message}`);
      reject(err);
    });

    serverProcess.on('close', (code) => {
      if (!serverReady) {
        error(`服务器意外退出，退出码: ${code}`);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    startupTimeout = setTimeout(() => {
      if (!serverReady) {
        error('服务器启动超时');
        reject(new Error('Server startup timeout'));
      }
    }, 30000);
  });
}

function checkServer() {
  return new Promise((resolve, reject) => {
    const port = actualPort || EXPECTED_PORT;
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET',
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ statusCode: res.statusCode, body: data, headers: res.headers });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    let retries = 0;

    function tryConnect() {
      checkServer()
        .then(resolve)
        .catch(() => {
          retries++;
          if (retries >= MAX_RETRIES) {
            reject(new Error(`服务器在 ${MAX_RETRIES} 次尝试后仍不可用`));
            return;
          }
          log(`服务器未就绪，正在重试 (${retries}/${MAX_RETRIES})...`);
          setTimeout(tryConnect, RETRY_INTERVAL);
        });
    }

    tryConnect();
  });
}

function validateHtml(html) {
  const checks = [];

  const hasRootDiv = /<div[^>]*id=["']root["'][^>]*>/.test(html);
  checks.push({ name: '包含根元素 #root', pass: hasRootDiv });

  const hasScriptTag = /<script\b[^>]*>/.test(html);
  checks.push({ name: '包含脚本标签', pass: hasScriptTag });

  const hasJsSrc = /src=["'].*\.js["']/.test(html) || /src=["']\/assets\//.test(html);
  checks.push({ name: '包含 JS 资源引用', pass: hasJsSrc });

  const hasModuleScript = /type=["']module["']/.test(html);
  checks.push({ name: '包含 ES Module 脚本', pass: hasModuleScript });

  return checks;
}

async function runSmokeTests() {
  log('开始冒烟测试...');

  const portInUse = await isPortInUse(EXPECTED_PORT);
  if (portInUse) {
    error(`端口 ${EXPECTED_PORT} 已被占用，请先释放端口后重试`);
    process.exit(1);
  }

  try {
    await startServer();
  } catch (err) {
    error(`启动服务器失败: ${err.message}`);
    process.exit(1);
  }

  try {
    await waitForServer();
    log('服务器可访问');
  } catch (err) {
    error(`服务器不可访问: ${err.message}`);
    process.exit(1);
  }

  let response;
  try {
    response = await checkServer();
    log(`HTTP 状态码: ${response.statusCode}`);
  } catch (err) {
    error(`HTTP 请求失败: ${err.message}`);
    process.exit(1);
  }

  const checks = validateHtml(response.body);
  let allPassed = true;

  console.log('\n--- HTML 验证结果 ---');
  checks.forEach((check) => {
    const status = check.pass ? '✓ 通过' : '✗ 失败';
    console.log(`  ${status}: ${check.name}`);
    if (!check.pass) allPassed = false;
  });

  console.log('\n--- 响应信息 ---');
  console.log(`  内容长度: ${response.body.length} 字节`);
  console.log(`  端口: ${actualPort || EXPECTED_PORT}`);
  console.log(`  Content-Type: ${response.headers['content-type'] || 'N/A'}`);

  if (allPassed) {
    log('所有冒烟测试通过 ✓');
    process.exit(0);
  } else {
    error('部分冒烟测试失败');
    process.exit(1);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--dev')) {
    serverType = 'dev';
  }

  runSmokeTests();
}

module.exports = { checkServer, validateHtml, EXPECTED_PORT };
