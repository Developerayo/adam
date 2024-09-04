import os from 'os'
import path from 'path'
import fs from 'fs'

export function getOsType() {
  return os.type()
}

export function checkForFileOrFolder(name, isFile = false) {
  const fullPath = path.join(process.cwd(), name)
  try {
    const stats = fs.statSync(fullPath)
    return isFile ? stats.isFile() : stats.isDirectory()
  } catch (error) {
    return false
  }
}
