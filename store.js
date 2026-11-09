const {
  DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand, BatchGetItemCommand,
} = require("@aws-sdk/client-dynamodb");

const S = value => ({ S: value });
const N = value => ({ N: String(value) });

function makeStore(table, guild, pair, client = new DynamoDBClient({ maxAttempts: 1 })) {
  if (!table) throw new Error("Missing DynamoDB table name.");
  const key = sk => ({ pk: S(guild), sk: S(sk) });
  const send = (operation, signal = AbortSignal.timeout(1200)) => client.send(operation, { abortSignal: signal });

  async function write(operation) {
    try {
      await send(operation);
      return true;
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") return false;
      throw error;
    }
  }

  return {
    add(id, text) {
      // Discord may retry delivery. The interaction ID is the item's identity.
      return write(new PutItemCommand({
        TableName: table, Item: { ...key("list#" + id), text: S(text) },
        ConditionExpression: "attribute_not_exists(pk)",
      }));
    },
    async list() {
      const rows = [];
      const signal = AbortSignal.timeout(1200);
      let start;
      do {
        const page = await send(new QueryCommand({
          TableName: table, KeyConditionExpression: "pk = :guild AND begins_with(sk, :prefix)",
          FilterExpression: "attribute_not_exists(completed)",
          ExpressionAttributeValues: { ":guild": S(guild), ":prefix": S("list#") },
          ScanIndexForward: false, ConsistentRead: true, Limit: 50, ExclusiveStartKey: start,
        }), signal);
        for (const item of page.Items || []) rows.push({ id: item.sk.S.slice(5), text: item.text.S });
        start = page.LastEvaluatedKey;
      } while (start && rows.length < 8);
      return rows.slice(0, 8);
    },
    done(id) {
      // Keep a short-lived completion marker so a late add retry cannot revive it.
      return write(new UpdateItemCommand({
        TableName: table, Key: key("list#" + id),
        ConditionExpression: "attribute_exists(pk) AND attribute_not_exists(completed)",
        UpdateExpression: "SET completed = :done, expires_at = :expiry REMOVE #item_text",
        ExpressionAttributeNames: { "#item_text": "text" },
        ExpressionAttributeValues: { ":done": { BOOL: true }, ":expiry": N(Math.floor(Date.now() / 1000) + 86400) },
      }));
    },
    checkin(userId, id, mood, note) {
      return write(new PutItemCommand({
        TableName: table, Item: { ...key("mood#" + userId), mood: S(mood), note: S(note), interaction_id: N(id) },
        ConditionExpression: "attribute_not_exists(pk) OR interaction_id < :latest",
        ExpressionAttributeValues: { ":latest": N(id) },
      }));
    },
    async moods() {
      const result = await send(new BatchGetItemCommand({
        RequestItems: { [table]: { Keys: pair.map(id => key("mood#" + id)), ConsistentRead: true } },
      }));
      if (result.UnprocessedKeys?.[table]?.Keys?.length) throw new Error("Partial read");
      return (result.Responses?.[table] || []).map(item => ({
        userId: item.sk.S.slice(5), mood: item.mood.S, note: item.note.S,
      }));
    },
  };
}

module.exports = { makeStore };
