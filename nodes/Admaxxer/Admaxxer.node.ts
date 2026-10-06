import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeProperties,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { callTool } from './transport';

// One row per operation: the tool it calls and, for lists, the array to turn
// into n8n items.
const OPERATIONS: Record<string, { tool: string; split?: string }> = {
	'analytics:getSummary': { tool: 'admaxxer_get_summary_kpis' },
	'analytics:getWebAnalytics': { tool: 'admaxxer_get_web_analytics' },
	'analytics:getAttribution': { tool: 'admaxxer_get_attribution_breakdown' },
	'analytics:getAudience': { tool: 'admaxxer_get_audience_demographics' },
	'analytics:getAiSearchVisibility': { tool: 'admaxxer_get_ai_search_visibility' },
	'analytics:getAiCitations': { tool: 'admaxxer_get_ai_citations' },
	'adAccount:getAll': { tool: 'admaxxer_list_connections', split: 'connections' },
	'adAccount:getInsights': { tool: 'admaxxer_get_account_insights' },
	'campaign:getAll': { tool: 'admaxxer_list_campaigns', split: 'campaigns' },
	'campaign:getInsights': { tool: 'admaxxer_get_campaign_insights' },
	'alert:getAll': { tool: 'admaxxer_list_alerts' },
	'workspace:get': { tool: 'admaxxer_whoami' },
};

const DATED = [
	'getSummary',
	'getWebAnalytics',
	'getAttribution',
	'getAudience',
	'getInsights',
	'getAll',
];

const day = (value: unknown): string | undefined =>
	typeof value === 'string' && value !== '' ? value.slice(0, 10) : undefined;

type Show = { resource: string[]; operation?: string[] };

function connectionField(show: Show): INodeProperties[] {
	return [
		{
			displayName: 'Ad Account Name or ID',
			name: 'connectionId',
			type: 'options',
			typeOptions: { loadOptionsMethod: 'getConnections' },
			default: '',
			required: true,
			description:
				'The connected ad account. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			displayOptions: { show },
		},
	];
}

function optionsField(show: Show): INodeProperties[] {
	return [
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: { show },
			options: [
				{
					displayName: 'Date From',
					name: 'dateFrom',
					type: 'dateTime',
					default: '',
					description: 'Start of the window (inclusive). Defaults to the last 7 days.',
				},
				{
					displayName: 'Date To',
					name: 'dateTo',
					type: 'dateTime',
					default: '',
					description: 'End of the window (inclusive). Defaults to today, UTC.',
				},
				...(show.resource[0] === 'analytics'
					? [
							{
								displayName: 'Website ID',
								name: 'websiteId',
								type: 'string' as const,
								default: '',
								description: 'A tracked website in this workspace. Defaults to the workspace’s default site.',
							},
						]
					: []),
			],
		},
	];
}

export class Admaxxer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Admaxxer',
		name: 'admaxxer',
		icon: { light: 'file:../../icons/admaxxer.svg', dark: 'file:../../icons/admaxxer.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Marketing analytics: revenue attribution, web analytics, ad spend and ROAS across Meta, Google and TikTok, AI search visibility and alerts. Read-only.',
		defaults: {
			name: 'Admaxxer',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'admaxxerApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Ad Account', value: 'adAccount' },
					{ name: 'Alert', value: 'alert' },
					{ name: 'Analytics', value: 'analytics' },
					{ name: 'Campaign', value: 'campaign' },
					{ name: 'Workspace', value: 'workspace' },
				],
				default: 'analytics',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['analytics'] } },
				options: [
					{
						name: 'Get AI Citations',
						value: 'getAiCitations',
						action: 'Get AI citations',
						description: 'Where AI assistants cite your site, and for which questions',
					},
					{
						name: 'Get AI Search Visibility',
						value: 'getAiSearchVisibility',
						action: 'Get AI search visibility',
						description: 'How often your brand shows up in AI search answers',
					},
					{
						name: 'Get Attribution',
						value: 'getAttribution',
						action: 'Get revenue attribution by channel',
						description: 'Revenue, spend, ROAS, orders and CPA per channel under the attribution model you choose',
					},
					{
						name: 'Get Audience',
						value: 'getAudience',
						action: 'Get audience demographics',
						description: 'Age and gender split of the people your Meta and Google ads reached',
					},
					{
						name: 'Get Summary',
						value: 'getSummary',
						action: 'Get KPI summary',
						description:
							'Sales, profit, blended spend, blended ROAS, MER, orders, AOV, sessions and visitors for a date range',
					},
					{
						name: 'Get Web Analytics',
						value: 'getWebAnalytics',
						action: 'Get web analytics',
						description: 'Visitors, sessions, pageviews, bounce rate, session duration and conversion rate for a tracked website',
					},
				],
				default: 'getSummary',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['adAccount'] } },
				options: [
					{
						name: 'Get Insights',
						value: 'getInsights',
						action: 'Get ad account insights',
						description: 'The ad platform’s delivery numbers for one ad account, such as spend and impressions',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many ad accounts',
						description: 'List the connected Meta, Google, TikTok, Shopify and Klaviyo accounts',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['campaign'] } },
				options: [
					{
						name: 'Get Insights',
						value: 'getInsights',
						action: 'Get campaign insights',
						description: 'The ad platform’s delivery numbers for one campaign',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many campaigns',
						description: 'List campaigns in an ad account with spend, revenue and ROAS for the date range',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['alert'] } },
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get alert rules and recent alerts',
						description: 'Your alert rules and the alerts that fired recently',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['workspace'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						action: 'Get workspace',
						description: 'The workspace this token reads, its scopes, plan and connections',
					},
				],
				default: 'get',
			},
			...connectionField({ resource: ['adAccount'], operation: ['getInsights'] }),
			...connectionField({ resource: ['campaign'] }),
			{
				displayName: 'Campaign ID',
				name: 'campaignId',
				type: 'string',
				default: '',
				required: true,
				description: 'The platform campaign ID, from Campaign → Get Many',
				displayOptions: { show: { resource: ['campaign'], operation: ['getInsights'] } },
			},
			{
				displayName: 'Attribution Model',
				name: 'model',
				type: 'options',
				default: 'last_click',
				displayOptions: { show: { resource: ['analytics'], operation: ['getAttribution'] } },
				options: [
					{ name: 'First Click', value: 'first_click' },
					{ name: 'Last Click', value: 'last_click' },
					{ name: 'Last Non-Direct Click', value: 'last_click_non_direct' },
					{ name: 'Linear (All Touches)', value: 'linear_all' },
					{ name: 'Linear (Paid Touches)', value: 'linear_paid' },
					{ name: 'Position Based', value: 'position_based' },
					{ name: 'Reconciled', value: 'reconciled' },
					{ name: 'Time Decay', value: 'time_decay' },
				],
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				default: '',
				displayOptions: { show: { resource: ['analytics'], operation: ['getAudience'] } },
				options: [
					{ name: 'Both', value: '' },
					{ name: 'Google', value: 'google' },
					{ name: 'Meta', value: 'meta' },
				],
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show: { resource: ['campaign'], operation: ['getAll'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 200 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: { show: { resource: ['campaign'], operation: ['getAll'], returnAll: [false] } },
			},
			...optionsField({ resource: ['analytics'], operation: ['getSummary', 'getWebAnalytics', 'getAttribution', 'getAudience'] }),
			...optionsField({ resource: ['adAccount'], operation: ['getInsights'] }),
			...optionsField({ resource: ['campaign'] }),
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const data = await callTool.call(this, 'admaxxer_list_connections', {});
				const connections = (data.connections as IDataObject[] | undefined) ?? [];
				return connections.map((connection) => ({
					name: `${String(connection.platform)} · ${String(connection.accountLabel ?? connection.accountId ?? connection.id)}`,
					value: connection.id as string,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const spec = OPERATIONS[`${resource}:${operation}`];
				const hasOptions =
					resource === 'campaign' ||
					(resource === 'adAccount' && operation === 'getInsights') ||
					(resource === 'analytics' && DATED.includes(operation));
				const options = (hasOptions ? this.getNodeParameter('options', i, {}) : {}) as IDataObject;

				const args: IDataObject = {};
				const from = day(options.dateFrom);
				const to = day(options.dateTo);
				if (from) args.date_from = from;
				if (to) args.date_to = to;
				if (options.websiteId) args.website_id = options.websiteId;

				if (resource === 'campaign' || (resource === 'adAccount' && operation === 'getInsights')) {
					args.connection_id = this.getNodeParameter('connectionId', i) as string;
				}
				if (resource === 'campaign' && operation === 'getInsights') {
					args.campaign_id = this.getNodeParameter('campaignId', i) as string;
				}
				if (operation === 'getAttribution') args.model = this.getNodeParameter('model', i) as string;
				if (operation === 'getAudience') {
					const platform = this.getNodeParameter('platform', i) as string;
					if (platform) args.platform = platform;
				}

				if (resource === 'campaign' && operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
					const rows: IDataObject[] = [];
					let cursor: string | undefined;
					do {
						const page = await callTool.call(
							this,
							spec.tool,
							{ ...args, limit: Math.min(200, limit - rows.length), ...(cursor ? { cursor } : {}) },
							i,
						);
						rows.push(...(((page.campaigns as IDataObject[] | undefined) ?? [])));
						cursor = (page.next_cursor as string | null | undefined) ?? undefined;
					} while (cursor && rows.length < limit);
					for (const row of rows.slice(0, limit === Infinity ? undefined : limit)) {
						returnData.push({ json: row, pairedItem: { item: i } });
					}
					continue;
				}

				const data = await callTool.call(this, spec.tool, args, i);
				const list = spec.split ? (data[spec.split] as IDataObject[] | undefined) : undefined;
				if (list) {
					for (const row of list) returnData.push({ json: row, pairedItem: { item: i } });
				} else {
					returnData.push({ json: data, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Keep n8n's own errors (they carry the API's message and fix); wrap anything else.
				const failure =
					error instanceof NodeApiError || error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				throw failure;
			}
		}

		return [returnData];
	}
}
