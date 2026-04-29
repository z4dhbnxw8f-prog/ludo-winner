import { spawn } from 'node:child_process'

const commands = [
  {
    label: 'server',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'server'],
  },
  {
    label: 'client',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'client'],
  },
]

const children = commands.map(({ label, command, args }) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${label} exited with code ${code}`)
      process.exit(code ?? 1)
    }
  })

  return child
})

function shutdown(signal) {
  children.forEach((child) => child.kill(signal))
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
