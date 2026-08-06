import {defineField, defineType} from 'sanity'

const deploymentStates = [
  {title: 'Idle', value: 'idle'},
  {title: 'Waiting for quiet period', value: 'queued'},
  {title: 'Requesting deployment', value: 'requesting'},
  {title: 'Deployment requested', value: 'requested'},
  {title: 'Action required', value: 'failed'},
]

export const deploymentStatus = defineType({
  name: 'deploymentStatus',
  title: 'Frontend deployment',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {list: deploymentStates},
    }),
    defineField({
      name: 'message',
      title: 'What is happening',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'receivedAt',
      title: 'Latest event received',
      type: 'datetime',
    }),
    defineField({
      name: 'transactionTime',
      title: 'Content transaction time',
      type: 'datetime',
    }),
    defineField({
      name: 'documentType',
      title: 'Changed content type',
      type: 'string',
    }),
    defineField({
      name: 'documentId',
      title: 'Changed document id',
      type: 'string',
    }),
    defineField({
      name: 'operation',
      title: 'Content operation',
      type: 'string',
      options: {
        list: [
          {title: 'Created', value: 'create'},
          {title: 'Updated', value: 'update'},
          {title: 'Deleted', value: 'delete'},
        ],
      },
    }),
    defineField({
      name: 'workflowUrl',
      title: 'GitHub workflow',
      type: 'url',
    }),
    defineField({
      name: 'deployJobId',
      title: 'Vercel deploy-hook job id',
      type: 'string',
    }),
    defineField({
      name: 'deploymentRequestedAt',
      title: 'Deployment requested at',
      type: 'datetime',
    }),
    defineField({
      name: 'lastError',
      title: 'Last error',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'latestEventKey',
      title: 'Latest event key',
      type: 'string',
      hidden: true,
    }),
    defineField({
      name: 'dispatchState',
      title: 'Dispatch state',
      type: 'string',
      hidden: true,
    }),
    defineField({
      name: 'claimId',
      title: 'Deployment claim owner',
      type: 'string',
      hidden: true,
    }),
    defineField({
      name: 'claimedAt',
      title: 'Deployment claimed at',
      type: 'datetime',
      hidden: true,
    }),
    defineField({
      name: 'eventId',
      title: 'Signed event revision',
      type: 'string',
      hidden: true,
    }),
    defineField({
      name: 'recentEventKeys',
      title: 'Recent event keys',
      type: 'array',
      of: [{type: 'string'}],
      hidden: true,
    }),
  ],
  preview: {
    select: {
      status: 'status',
      message: 'message',
    },
    prepare({status, message}) {
      return {
        title: 'Frontend deployment',
        subtitle: message || status || 'Waiting for the first verified content event',
      }
    },
  },
})
