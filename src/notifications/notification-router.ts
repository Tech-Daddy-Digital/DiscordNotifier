import { EmbedBuilder, type Client } from 'discord.js';

export type PlaceholderNotification = {
  title: string;
  message: string;
};

export type MockYouTubeLiveNotification = {
  channelName: string;
  videoTitle: string;
  videoUrl: string;
  startedAt: Date;
  pingRoleId?: string | undefined;
};

export type SendableTextChannel = {
  isTextBased: () => boolean;
  send: (payload: unknown) => Promise<unknown>;
};

export type NotificationRouterOptions = {
  notificationChannelId: string;
  fetchChannel: (channelId: string) => Promise<SendableTextChannel | null>;
};

export class NotificationRouter {
  private readonly notificationChannelId: string;
  private readonly fetchChannel: NotificationRouterOptions['fetchChannel'];

  constructor(options: NotificationRouterOptions) {
    this.notificationChannelId = options.notificationChannelId;
    this.fetchChannel = options.fetchChannel;
  }

  static fromClient(client: Client, notificationChannelId: string): NotificationRouter {
    return new NotificationRouter({
      notificationChannelId,
      fetchChannel: async (channelId) => {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased() || !('send' in channel)) return null;
        return channel as SendableTextChannel;
      },
    });
  }

  async sendPlaceholderNotification(notification: PlaceholderNotification): Promise<void> {
    const channel = await this.getConfiguredTextChannel();

    const embed = new EmbedBuilder()
      .setTitle(notification.title)
      .setDescription(notification.message)
      .setColor(0x8b5cf6)
      .setTimestamp(new Date())
      .setFooter({ text: 'PulseDaddy scaffold notification' });

    await channel.send({ embeds: [embed] });
  }

  async sendMockYouTubeLiveNotification(
    notification: MockYouTubeLiveNotification,
  ): Promise<void> {
    const channel = await this.getConfiguredTextChannel();
    const embed = new EmbedBuilder()
      .setTitle(`🔴 ${notification.channelName} is live on YouTube`)
      .setDescription(notification.videoTitle)
      .setURL(notification.videoUrl)
      .setColor(0xff0000)
      .addFields(
        { name: 'Event', value: 'Stream started', inline: true },
        { name: 'Started', value: notification.startedAt.toISOString(), inline: true },
      )
      .setTimestamp(notification.startedAt)
      .setFooter({ text: 'PulseDaddy mock YouTube integration' });

    const payload: { content?: string; embeds: EmbedBuilder[] } = { embeds: [embed] };
    if (notification.pingRoleId) payload.content = `<@&${notification.pingRoleId}>`;

    await channel.send(payload);
  }

  private async getConfiguredTextChannel(): Promise<SendableTextChannel> {
    const channel = await this.fetchChannel(this.notificationChannelId);

    if (!channel?.isTextBased()) {
      throw new Error(
        `Configured notification channel ${this.notificationChannelId} was not found or is not text-based`,
      );
    }

    return channel;
  }
}
