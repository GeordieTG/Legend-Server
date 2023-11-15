import SchemaBuilder from '@pothos/core'
import postgres from 'postgres'
import { User } from './types/user.js'

const sql = postgres('postgresql://postgres:postgres@localhost:5432/postgres')

const builder = new SchemaBuilder({});

const UserType = builder.objectRef<User>('UserType');
const LeagueType = builder.objectRef<League>('LeagueType');

builder.objectType(UserType, {
  description: 'A user of the legend application',
  fields: (t) => ({
    email: t.field({
      type: "String",
      resolve: (user) => user.email as string,
    }),
    name: t.field({
      type: "String",
      resolve: (user) => user.name as string,
    }),
  }),
});

builder.objectType(LeagueType, {
  description: 'A league of users that compete within an organisation',
  fields: (t) => ({
    name: t.field({
      type: "String",
      resolve: (league) => league.name as string,
    }),
    city: t.field({
      type: "String",
      resolve: (league) => league.city as string,
    }),
    owner_id: t.field({
      type: "Int",
      resolve: (league) => league.owner_id as number,
    }),
  }),
});

// Query
builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: UserType,
      args: {
        token: t.arg.string(),
      },
      resolve: async (_, args: any) => {
        const userData = await sql`SELECT * FROM "user" WHERE token = ${args.token}`;
        let returnUserDB: User = userData[0] as User; 
        return returnUserDB;
      },
    }),
    allLeagues: t.field({
      type: [LeagueType],
      resolve: async () => {
        const leagueData = await sql`SELECT * FROM "league"`;
        
        const leagues = leagueData.map(row => ({
          name: row.name,
          city: row.city,
          owner_id: row.owner_id
        }));
        return leagues as League[];
      },
    })
  }),
});

// Mutation
builder.mutationType({
  fields: (t) => ({
    createUser: t.boolean({
      args: {
        token: t.arg.string(),
        email: t.arg.string(),
        name: t.arg.string()
      },
      resolve: async (_, args: any) => {

        const result = await sql`
            INSERT INTO "user" (token, email, name)
            VALUES (${args.token}, ${args.email}, ${args.name})
            ON CONFLICT (email) DO UPDATE SET token = EXCLUDED.token
          `;
        return true;
      },
    }),
  }),
});

export const schema = builder.toSchema()