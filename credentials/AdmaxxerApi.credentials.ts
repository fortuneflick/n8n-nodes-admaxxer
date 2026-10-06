import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AdmaxxerApi implements ICredentialType {
	name = 'admaxxerApi';

	displayName = 'Admaxxer API';

	icon: Icon = { light: 'file:../icons/admaxxer.svg', dark: 'file:../icons/admaxxer.dark.svg' };

	documentationUrl = 'https://github.com/fortuneflick/n8n-nodes-admaxxer#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'A token from admaxxer.com → Integrations → MCP. A read-only token is all this node needs.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	// whoami reads the token's own workspace and scopes; any valid token can call it.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://admaxxer.com',
			url: '/mcp',
			method: 'POST',
			headers: { Accept: 'application/json, text/event-stream' },
			body: {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: { name: 'admaxxer_whoami', arguments: {} },
			},
		},
	};
}
