const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits, 
    ChannelType, 
    SlashCommandBuilder, 
    REST, 
    Routes 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.MessageContent
    ]
});

// ==================== CONFIGURATION ====================
const CONFIG = {
    // Railway Token (Environment Variable)
    TOKEN: process.env.TOKEN, 
    
    // Server & Bot IDs
    CLIENT_ID: "1540099644028096572", // ID dial Bot
    GUILD_ID: "1538685893622108251",       // ID dial Server
    
    // Customization & Links
    SERVER_BANNER: "https://cdn.discordapp.com/attachments/1315665568228966410/1540122036725350441/octopus_png_banner.png?ex=6a88cdeb&is=6a877c6b&hm=9f964c7489d7150b992380365654f836dec100d2b76a8c2daeb0e162bb15afac&", // Link dial Banner
    SETUP_CHANNEL_ID: "1538901953331986594", // Channel fin msmouh /setup-ticket
    WELCOME_CHANNEL_ID: "1540122188256911410", // Channel dial Welcome
    INVITES_REQUIRED: 6, // 3dad l-invites required for /spin

    // Categories & Staff Roles IDs for each Ticket
    TICKETS: {
        pub: {
            name: "Pub",
            label: "Pub",
            emoji: "🛡️",
            categoryId: "000000000000000000",
            roleId: "000000000000000000"
        },
        bugs: {
            name: "Bugs",
            label: "Bugs",
            emoji: "🔑",
            categoryId: "000000000000000000",
            roleId: "000000000000000000"
        },
        donate: {
            name: "Donate",
            label: "Donate",
            emoji: "💵",
            categoryId: "000000000000000000",
            roleId: "000000000000000000"
        },
        remplacement: {
            name: "Remplacement",
            label: "Remplacement",
            emoji: "🔨",
            categoryId: "000000000000000000",
            roleId: "000000000000000000"
        },
        spin: {
            name: "Spin Wheel",
            label: "Spin Wheel",
            emoji: "🎰",
            categoryId: "000000000000000000",
            roleId: "000000000000000000"
        }
    }
};

const invitesCache = new Map();
const projectsDir = path.join(__dirname, 'projects');

if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir);
}

// ==================== EVENTS ====================

client.once('ready', async () => {
    console.log(`🤖 Bot Ready! Logged in as ${client.user.tag}`);
    
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
        } catch (err) {
            console.log(`Could not fetch invites for ${guild.name}`);
        }
    }

    const commands = [
        new SlashCommandBuilder()
            .setName('setup-ticket')
            .setDescription('Setup the ticket panel (Admin only)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('spin')
            .setDescription('Spin to get a random project (Requires enough invites)')
    ];

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
            { body: commands }
        );
        console.log("✅ Commands registered!");
    } catch (error) {
        console.error("Error registering slash commands:", error);
    }
});

client.on('inviteCreate', invite => {
    const guildInvites = invitesCache.get(invite.guild.id) || new Map();
    guildInvites.set(invite.code, invite.uses);
    invitesCache.set(invite.guild.id, guildInvites);
});

client.on('guildMemberAdd', async member => {
    const cachedInvites = invitesCache.get(member.guild.id);
    const newInvites = await member.guild.invites.fetch();
    invitesCache.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));

    const welcomeChannel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setAuthor({ name: member.guild.name, iconURL: client.user.displayAvatarURL() })
            .setTitle(`👋 Welcome <@${member.id}>, to 🐙 | Octopus Studio You Are ${member.guild.memberCount} !`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `We are glad to have you here! We offer high-quality development services tailored to your needs.\n\n` +
                `🛒 **Our Services:**\n` +
                `• Custom Discord Bots Development\n` +
                `• Pre-built & Ready-to-use Bots\n` +
                `• Full Discord Server Setup & Configuration\n` +
                `• Custom Web & Software Development\n\n` +
                `💳 **Payment Methods:**\n` +
                `We accept **ALL** payment methods worldwide (Crypto, PayPal, Credit Cards, Bank Transfer, Local Payments, etc.)!\n\n` +
                `⭐ **How to get started?**\n` +
                `1. Check our work & feedback in <#channel-reviews>\n` +
                `2. View our prices in <#channel-prices>\n` +
                `3. Open a ticket in <#channel-tickets> to order or ask questions!\n\n` +
                `Enjoy your stay! 🚀`
            )
            .setImage(CONFIG.SERVER_BANNER)
            .setTimestamp();

        welcomeChannel.send({ embeds: [welcomeEmbed] });
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-ticket') {
            if (interaction.channelId !== CONFIG.SETUP_CHANNEL_ID) {
                return interaction.reply({ content: `❌ Had command t9dr ddirha ghir f <#${CONFIG.SETUP_CHANNEL_ID}>!`, ephemeral: true });
            }

            const ticketEmbed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setAuthor({ name: `${interaction.guild.name} • Ticket Support System`, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `• Welcome to our Support & Order Center! Please select the ticket type matching your request:\n\n` +
                    `• ${CONFIG.TICKETS.pub.emoji} **${CONFIG.TICKETS.pub.label}** : Report spam or pub ⚔️\n` +
                    `• ${CONFIG.TICKETS.bugs.emoji} **${CONFIG.TICKETS.bugs.label}** : Report bugs or issues ⚔️\n` +
                    `• ${CONFIG.TICKETS.remplacement.emoji} **${CONFIG.TICKETS.remplacement.label}** : Report issues or replacement ⚔️\n` +
                    `• ${CONFIG.TICKETS.donate.emoji} **${CONFIG.TICKETS.donate.label}** : Support The Server ⚔️\n` +
                    `• ${CONFIG.TICKETS.spin.emoji} **${CONFIG.TICKETS.spin.label}** : Open Spin Ticket ⚔️\n\n` +
                    `• 🌸⚡ Use these modules for assistance, orders or tickets. Our team is here to help!`
                )
                .setImage(CONFIG.SERVER_BANNER);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_pub').setLabel(CONFIG.TICKETS.pub.label).setEmoji(CONFIG.TICKETS.pub.emoji).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_bugs').setLabel(CONFIG.TICKETS.bugs.label).setEmoji(CONFIG.TICKETS.bugs.emoji).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_remplacement').setLabel(CONFIG.TICKETS.remplacement.label).setEmoji(CONFIG.TICKETS.remplacement.emoji).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_donate').setLabel(CONFIG.TICKETS.donate.label).setEmoji(CONFIG.TICKETS.donate.emoji).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_spin').setLabel(CONFIG.TICKETS.spin.label).setEmoji(CONFIG.TICKETS.spin.emoji).setStyle(ButtonStyle.Primary)
            );

            await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
            return interaction.reply({ content: "✅ Ticket Panel sent successfully!", ephemeral: true });
        }

        if (interaction.commandName === 'spin') {
            const channelCategory = interaction.channel.parentId;
            if (channelCategory !== CONFIG.TICKETS.spin.categoryId) {
                return interaction.reply({ content: "❌ Command `/spin` t9dr tst3mlha ghir f ticket dial Spin Wheel!", ephemeral: true });
            }

            const invites = await interaction.guild.invites.fetch();
            const userInvites = invites.filter(i => i.inviter && i.inviter.id === interaction.user.id);
            let totalInvites = 0;
            userInvites.forEach(inv => totalInvites += inv.uses);

            if (totalInvites < CONFIG.INVITES_REQUIRED) {
                return interaction.reply({ 
                    content: `❌ Khassk **${CONFIG.INVITES_REQUIRED}** invites ha9i9iyin bach ddir spin! Nta 3ndk **${totalInvites}** invites f9at.`, 
                    ephemeral: true 
                });
            }

            const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.txt'));
            if (files.length === 0) {
                return interaction.reply({ content: "❌ Ulac project files f folder dial projects حاليا.", ephemeral: true });
            }

            const randomFile = files[Math.floor(Math.random() * files.length)];
            const filePath = path.join(projectsDir, randomFile);

            await interaction.reply({ 
                content: `🎉 **Mabrouk!** Ha huwa l-project dialk li jtik f l-Spin Wheel (${randomFile}):`,
                files: [filePath]
            });
        }
    }

    if (interaction.isButton()) {
        const typeMap = {
            'btn_pub': CONFIG.TICKETS.pub,
            'btn_bugs': CONFIG.TICKETS.bugs,
            'btn_remplacement': CONFIG.TICKETS.remplacement,
            'btn_donate': CONFIG.TICKETS.donate,
            'btn_spin': CONFIG.TICKETS.spin
        };

        const selectedTicket = typeMap[interaction.customId];
        if (!selectedTicket) return;

        const category = interaction.guild.channels.cache.get(selectedTicket.categoryId);
        if (!category) {
            return interaction.reply({ content: "❌ Category dial had ticket makhddamach! Check IDs f config.", ephemeral: true });
        }

        const ticketChannel = await interaction.guild.channels.create({
            name: `${selectedTicket.name.toLowerCase()}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                },
                {
                    id: selectedTicket.roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                }
            ]
        });

        const embedMsg = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle(`${selectedTicket.emoji} Ticket: ${selectedTicket.name}`)
            .setDescription(`Marhaba <@${interaction.user.id}>! L-staff <@&${selectedTicket.roleId}> ghadi yjawbouk f 9reb wa9t.`)
            .setThumbnail(client.user.displayAvatarURL());

        if (interaction.customId === 'btn_spin') {
            embedMsg.addFields({ name: "🎰 Spin Instructions", value: "Ila 3ndk 6 invites awktar, ktab `/spin` hna bach takhod project dialk!" });
        }

        await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${selectedTicket.roleId}>`, embeds: [embedMsg] });

        return interaction.reply({ content: `✅ Ticket dialk tft7at hna: ${ticketChannel}`, ephemeral: true });
    }
});

client.login(CONFIG.TOKEN);
