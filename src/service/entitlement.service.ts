import { Prisma } from "../prisma/generated/prisma/client.js";
import { db } from "../server.js";

class EntitlementService {
    async createEntitlement(data: Prisma.EntitlementCreateInput) {
        return await db.entitlement.create({
            data
        });
    }

    async getEntitlementById(id: string) {
        return await db.entitlement.findUnique({
            where: { id }
        });
    }

    async getAllEntitlements({ query }: { query?: Prisma.EntitlementFindManyArgs } = {}) {
        const [entitlements, total_entitlements] = await Promise.all([
            db.entitlement.findMany(query),
            db.entitlement.count({ where: query?.where })
        ]);
        return { entitlements, total_entitlements };
    }
}

export const entitlement_service = new EntitlementService();