# Elasticsearch example

You need to configure the `.env` variable for running the example.

You can copy & paste the file `.env.example` in `.env` file in the folder
`examples/src/indexes/vector_stores/elasticsearch`.

Now you to execute the Elasticsearch instance using the following docker
command:

```bash
docker-compose up -d --build
```

This will execute Elasticsearch at `localhost:9200`.

Finally, to run the example you need to execute the following command
from the `examples` folder:

```bash
yarn run start ./src/indexes/vector_stores/elasticsearch/elasticsearch.ts
```