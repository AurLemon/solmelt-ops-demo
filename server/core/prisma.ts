import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../../generated/prisma/client'

let prismaClient: PrismaClient | undefined

export function usePrisma(): PrismaClient {
	if (prismaClient) return prismaClient

	const config = useRuntimeConfig()
	const adapter = new PrismaMariaDb({
		host: config.databaseHost,
		port: config.databasePort,
		user: config.databaseUser,
		password: config.databasePassword,
		database: config.databaseName,
		connectionLimit: 5,
		connectTimeout: 5_000,
	})

	prismaClient = new PrismaClient({ adapter })
	return prismaClient
}
