import {
	NodeApiError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type JsonObject,
} from 'n8n-workflow';

const MCP_URL = 'https://admaxxer.com/mcp';

type ToolResult = {
	isError?: boolean;
	structuredContent?: IDataObject;
	content?: Array<{ type: string; text?: string }>;
};

type RpcResponse = {
	result?: ToolResult;
	error?: { code?: number; message?: string };
};

// Admaxxer's analytics are served as named tools over one stateless JSON-RPC
// endpoint: each call is a single POST, no session to open or close. A tool
// refusal arrives as isError with { error: { code, message, fix } }.
export async function callTool(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	name: string,
	args: IDataObject,
	itemIndex = 0,
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: MCP_URL,
		headers: {
			Accept: 'application/json, text/event-stream',
			'Content-Type': 'application/json',
		},
		body: {
			jsonrpc: '2.0',
			id: 1,
			method: 'tools/call',
			params: { name, arguments: args },
		},
		json: true,
	};

	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'admaxxerApi',
		options,
	)) as RpcResponse;

	if (response.error) {
		throw new NodeApiError(this.getNode(), response.error as JsonObject, {
			message: response.error.message ?? 'Admaxxer refused the request',
			itemIndex,
		});
	}

	const result = response.result ?? {};
	let data = result.structuredContent;
	if (!data) {
		const text = result.content?.find((part) => part.type === 'text')?.text ?? '';
		try {
			data = JSON.parse(text) as IDataObject;
		} catch {
			data = { summary: text };
		}
	}

	if (result.isError) {
		// Two shapes in the wild: { error: { code, message, fix } } and
		// { error: "<code>", message, fix }.
		const nested = typeof data.error === 'object' && data.error !== null ? (data.error as IDataObject) : {};
		const message = (nested.message ?? data.message ?? data.summary) as string | undefined;
		const fix = (nested.fix ?? data.fix) as string | undefined;
		throw new NodeApiError(this.getNode(), data as JsonObject, {
			message: message ?? 'Admaxxer refused the request',
			description: fix,
			itemIndex,
		});
	}

	return data;
}
