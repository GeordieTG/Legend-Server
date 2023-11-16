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
    email: t.exposeString('email'),
    name: t.exposeString('name')
  }),
});

builder.objectType(LeagueType, {
  description: 'A league of users that compete within an organisation',
  fields: (t) => ({
    name: t.exposeString('name'),
    city: t.exposeString('city'),
    owner: t.field({
      type: UserType,
      resolve: async (league) => {
        const dbResult = await sql`SELECT * FROM "user" WHERE email = ${league.owner_id}`
        let result = dbResult[0] as User
        return result
    }}),
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
    leagues: t.field({
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
    }),
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