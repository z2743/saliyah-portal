-- Remove obsolete one-million cap from fictional bot engagement.
DROP TRIGGER IF EXISTS x_bot_reach_seed;
ALTER TABLE x_bot_reach RENAME TO x_bot_reach_legacy;
CREATE TABLE x_bot_reach (
 post_id TEXT PRIMARY KEY REFERENCES x_posts(id),
 bot_likes INTEGER NOT NULL DEFAULT 0 CHECK(bot_likes>=0),
 bot_reposts INTEGER NOT NULL DEFAULT 0 CHECK(bot_reposts>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO x_bot_reach(post_id,bot_likes,bot_reposts,created_at)
 SELECT post_id,bot_likes,bot_reposts,created_at FROM x_bot_reach_legacy;
DROP TABLE x_bot_reach_legacy;
CREATE TRIGGER x_bot_reach_seed AFTER INSERT ON x_posts
 WHEN NEW.reply_to IS NULL AND NEW.repost_of IS NULL
 BEGIN
  INSERT INTO x_bot_reach(post_id,bot_likes,bot_reposts)
  VALUES(NEW.id,100+abs(random()%1000),abs(random()%100));
 END;
