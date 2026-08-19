import { pgTable, serial, text, boolean, integer } from "drizzle-orm/pg-core";

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  cardId: text("card_id").notNull(),
  year: text("year").notNull().default(""),
  cardSet: text("card_set").notNull().default(""),
  cardNo: text("card_no").notNull().default(""),
  playerName: text("player_name").notNull().default(""),
  cardDescription: text("card_description").notNull().default(""),
  variant: text("variant").notNull().default(""),
  collecting: boolean("collecting").notNull().default(false),
  got: boolean("got").notNull().default(false),
  imageUrl: text("image_url").default(""),
  sheet: text("sheet").notNull().default("master"),
  rowIndex: integer("row_index").notNull().default(0),
});
