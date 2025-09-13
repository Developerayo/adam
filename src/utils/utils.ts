import os from 'os'
import path from 'path'
import fs from 'fs/promises'

export function getOsType(): string {
	return os.type()
}

export async function checkForFileOrFolder(
	name: string,
	isFile: boolean = false,
): Promise<boolean> {
	const fullPath = path.join(process.cwd(), name)
	try {
		const stats = await fs.stat(fullPath)
		return isFile ? stats.isFile() : stats.isDirectory()
	} catch (error) {
		return false
	}
}
