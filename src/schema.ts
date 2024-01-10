import SchemaBuilder from '@pothos/core'
import postgres from 'postgres'
import { User } from './types/user.js'

const sql = postgres('postgresql://postgres:postgres@localhost:5432/postgres')

const builder = new SchemaBuilder({});

const UserType = builder.objectRef<User>('UserType');
const LeagueType = builder.objectRef<League>('LeagueType');
const MessageType = builder.objectRef<Message>('MessageType');

builder.objectType(UserType, {
  description: 'A user of the legend application',
  fields: (t) => ({
    email: t.exposeString('email'),
    name: t.exposeString('name'),
    leagues: t.field({
      type: [LeagueType],
      resolve: async (user) => {
        const dbRegistration: Array<any> = await sql`SELECT * FROM "league_registration" WHERE user_id = ${user.email}`
                
        const leagues: Array<any> = await Promise.all(dbRegistration.map( async (registration) => {
          const dbLeague = await sql`SELECT * FROM "league" WHERE id = ${registration.league_id}`
          return dbLeague[0]
        }))

        return leagues as League[];
      }
    })
  }),
});

builder.objectType(MessageType, {
  description: 'A message within a leagues chat',
  fields: (t) => ({
    text: t.exposeString('text'),
    name: t.exposeString('name'),
    time: t.exposeString('time'),
    room: t.exposeString('room')
  }),
});

builder.objectType(LeagueType, {
  description: 'A league of users that compete within an organisation',
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString('name'),
    city: t.exposeString('city'),
    size: t.exposeInt('size'),
    members: t.field({
      type: [UserType],
      resolve: async (league) => {
        const dbRegistration: Array<any> = await sql`SELECT * FROM "league_registration" WHERE league_id = ${league.id}`
        const members: Array<any> = await Promise.all(dbRegistration.map( async (registration) => {
          const dbLeague = await sql`SELECT * FROM "user" WHERE email = ${registration.user_id}`
          return dbLeague[0]
        }))
        return members as User[];
    }}),
    owner: t.field({
      type: UserType,
      resolve: async (league) => {
        const dbResult = await sql`SELECT * FROM "user" WHERE email = ${league.owner_id}`
        let result = dbResult[0] as User
        return result
    }}),
  }),
});

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
    league: t.field({
      type: LeagueType,
      args: {
        id: t.arg.string(),
      },
      resolve: async (_, args: any) => {
        const leagueData = await sql`SELECT * FROM "league" WHERE id = ${args.id}`;
        let returnLeagueDB: League = leagueData[0] as League; 
        return returnLeagueDB;
      },
    }),
    leagues: t.field({
      type: [LeagueType],
      resolve: async () => {
        const leagues: Array<any> = await sql`SELECT * FROM "league"`;
        return leagues as League[];
      },
    }),
    messages: t.field({
      type: [MessageType],
      args: {
        room: t.arg.string()
      },
      resolve: async (_, args:any) => {
        const messages: Array<any> = await sql`SELECT * FROM "message" where room=${args.room}`;
        return messages as Message[];
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
    createLeague: t.boolean({
      args: {
        name: t.arg.string(),
        city: t.arg.string(),
        size: t.arg.int(),
        owner_id: t.arg.string()
      },
      resolve: async (_, args: any) => {

        await sql.begin(async (sql) => {

          // Create League
          const league = await sql`
              INSERT INTO "league" (name, city, size, owner_id)
              VALUES (${args.name}, ${args.city}, ${args.size}, ${args.owner_id})
              RETURNING id
            `          
          // Register User to the League
          await sql`
          INSERT INTO "league_registration" (league_id, user_id)
          VALUES (${league[0].id}, ${args.owner_id})
          `
        });

        return true;
      },
    }),
  }),
});

export const schema = builder.toSchema()