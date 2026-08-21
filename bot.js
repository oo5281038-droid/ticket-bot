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
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActivityType
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
    TOKEN: process.env.TOKEN, 
    
    CLIENT_ID: "1540099644028096572", 
    GUILD_ID: "1538685893622108251",  
    
    FREE_SPIN_ADMIN_ROLE_ID: "1538910850272722997", 

    SERVER_BANNER: "https://cdn.discordapp.com/attachments/1315665568228966410/1540122036725350441/octopus_png_banner.png", 
    SETUP_CHANNEL_ID: "1538901953331986594", 
    INVITES_REQUIRED: 6, 

    STREAMING: {
        NAME: "Discord.gg/Octopus-s",
        URL: "https://www.twitch.tv/discord" 
    },

    EMOJIS: {
        PUB: "<:kndpub:1540126362658938940>",
        BUGS: "<a:emoji:1540126667815526451>",
        DONATE: "<:mny:1540091412719210637>",
        REMPLACEMENT: "<a:work1:1540127049132286022>",
        SPIN: "<a:extra_7:1540127733231648808>",
        BUY_ORDER: "🛒",
        APPLY_SELLER: "📋",
        DELETE: "<:delete:1540129242107346984>",
        CLAIM: "<:claim:1540129878916210738>",
        RENAME: "<:emoji_164:1539801927955648552>",

        BOT_READY: "🤖",
        SUCCESS: "✅",
        ERROR: "❌",
        LOCK: "🔒",
        SWORD: "⚔️",
        FLOWER_SPARK: "🌸⚡",
        TIMER: "⏱️",
        FREE_SPIN_TICKET: "🎟️",
        STATS: "📊",
        CONGRATS: "🎉",
        INBOX: "📥",
        WARNING: "⚠️",
        PENCIL: "✏️",
        SLOT_MACHINE: "🎰"
    },

    TICKETS: {
        pub: { name: "Pub", label: "Pub", categoryId: "1540123963043086417", roleId: "1540124358771605565" },
        bugs: { name: "Bugs", label: "Bugs", categoryId: "1540123985860239472", roleId: "1540124504406098071" },
        donate: { name: "Donate", label: "Donate", categoryId: "1540123940700299374", roleId: "1540124475503280229" },
        remplacement: { name: "Remplacement", label: "Remplacement", categoryId: "1540123905480462456", roleId: "1540124434772533308" },
        spin: { name: "Spin Wheel", label: "Spin Wheel", categoryId: "1540124005137121370", roleId: "1540124575042637955" },
        buy_order: { name: "Buy Order", label: "Buy Order", categoryId: "ID_CATEGORY_BUY_ORDER", roleId: "ID_ROLE_BUY_ORDER" },
        apply_seller: { name: "Apply Seller", label: "Apply Seller", categoryId: "ID_CATEGORY_APPLY_SELLER", roleId: "ID_ROLE_SELLER_MANAGERS" }
    }
};

const invitesCache = new Map();
const projectsDir = path.join(__dirname, 'projects');
const spinsFilePath = path.join(__dirname, 'free_spins.json');

if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir);

function getFreeSpinsData() {
    if (!fs.existsSync(spinsFilePath)) fs.writeFileSync(spinsFilePath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(spinsFilePath, 'utf8'));
}

function saveFreeSpinsData(data) {
    fs.writeFileSync(spinsFilePath, JSON.stringify(data, null, 2));
}

function getTicketTypeByChannel(channel) {
    if (!channel || !channel.parentId) return null;
    return Object.values(CONFIG.TICKETS).find(t => t.categoryId === channel.parentId);
}

function cleanExpiredSpins() {
    const spinsData = getFreeSpinsData();
    const now = Date.now();
    let updated = false;

    for (const userId in spinsData) {
        if (spinsData[userId].expiresAt && spinsData[userId].expiresAt < now) {
            delete spinsData[userId];
            updated = true;
        }
    }
    if (updated) saveFreeSpinsData(spinsData);
}

setInterval(cleanExpiredSpins, 60000);

function getAllTxtFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllTxtFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.txt')) {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

// ==================== READY EVENT & SLASH COMMANDS ====================

client.once('ready', async () => {
    console.log(`${CONFIG.EMOJIS.BOT_READY} Bot Ready! Logged in as ${client.user.tag}`);
    cleanExpiredSpins();
    
    client.user.setActivity(CONFIG.STREAMING.NAME, {
        type: ActivityType.Streaming,
        url: CONFIG.STREAMING.URL
    });

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
        } catch (err) {
            console.log(`Could not fetch invites for ${guild.name}`);
        }
    }

    const commands = [
        new SlashCommandBuilder().setName('setup-ticket').setDescription('Setup the ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder().setName('spin').setDescription('Spin to get a random project'),
        new SlashCommandBuilder().setName('givefreespin').setDescription('Give free spins to a specific user')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true))
            .addNumberOption(o => o.setName('hours').setDescription('Hours').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
        console.log(`${CONFIG.EMOJIS.SUCCESS} Commands registered!`);
    } catch (error) {
        console.error("Error registering slash commands:", error);
    }
});

// ==================== MESSAGE & AUTO RENAME HANDLER ====================

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Auto-Rename functionality for Buy Order Category
    if (message.channel.parentId === CONFIG.TICKETS.buy_order.categoryId) {
        if (message.content.toLowerCase().startsWith('need')) {
            const formattedName = message.content.toLowerCase().replace(/[^a-z0-9- ]/g, '').trim().replace(/\s+/g, '-');
            await message.channel.setName(formattedName).catch(() => {});
            await message.react('✅').catch(() => {});
        }
    }

    const ticketConfig = getTicketTypeByChannel(message.channel);
    if (!ticketConfig) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === '$close') {
        await message.reply(`${CONFIG.EMOJIS.LOCK} Closing ticket in 5 seconds...`);
        setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    }

    if (command === '$claim') {
        const hasStaffRole = message.member.roles.cache.has(ticketConfig.roleId);
        if (!hasStaffRole && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(`${CONFIG.EMOJIS.ERROR} Only staff members can claim this ticket!`);
        }
        const newName = `claimed-by-${message.author.username}`;
        await message.channel.setName(newName);
        return message.reply(`${CONFIG.EMOJIS.SUCCESS} Ticket claimed by **<@${message.author.id}>**!`);
    }

    if (command === '$rename') {
        const newName = args.join('-');
        if (!newName) return message.reply(`${CONFIG.EMOJIS.ERROR} Please provide a name!`);
        await message.channel.setName(newName);
        return message.reply(`${CONFIG.EMOJIS.PENCIL} Ticket renamed to: \`${newName}\``);
    }
});

// ==================== INTERACTION HANDLING ====================

client.on('interactionCreate', async interaction => {
    
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-ticket') {
            if (interaction.channelId !== CONFIG.SETUP_CHANNEL_ID) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Use this command in <#${CONFIG.SETUP_CHANNEL_ID}>!`, ephemeral: true });
            }

            const ticketEmbed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setAuthor({ name: `${interaction.guild.name} • Ticket Support System`, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `• Welcome to our Support & Order Center!\n\n` +
                    `• ${CONFIG.EMOJIS.PUB} **${CONFIG.TICKETS.pub.label}** : Report spam or pub ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.BUGS} **${CONFIG.TICKETS.bugs.label}** : Report bugs or issues ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.REMPLACEMENT} **${CONFIG.TICKETS.remplacement.label}** : Report issues or replacement ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.DONATE} **${CONFIG.TICKETS.donate.label}** : Support The Server ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.SPIN} **${CONFIG.TICKETS.spin.label}** : Open Spin Ticket ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.BUY_ORDER} **${CONFIG.TICKETS.buy_order.label}** : Create a buy order ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.APPLY_SELLER} **${CONFIG.TICKETS.apply_seller.label}** : Apply to become a seller ${CONFIG.EMOJIS.SWORD}`
                )
                .setImage(CONFIG.SERVER_BANNER);

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_pub').setLabel(CONFIG.TICKETS.pub.label).setEmoji(CONFIG.EMOJIS.PUB).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_bugs').setLabel(CONFIG.TICKETS.bugs.label).setEmoji(CONFIG.EMOJIS.BUGS).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_remplacement').setLabel(CONFIG.TICKETS.remplacement.label).setEmoji(CONFIG.EMOJIS.REMPLACEMENT).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_donate').setLabel(CONFIG.TICKETS.donate.label).setEmoji(CONFIG.EMOJIS.DONATE).setStyle(ButtonStyle.Success)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_spin').setLabel(CONFIG.TICKETS.spin.label).setEmoji(CONFIG.EMOJIS.SPIN).setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_buy_order').setLabel(CONFIG.TICKETS.buy_order.label).setEmoji(CONFIG.EMOJIS.BUY_ORDER).setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_apply_seller').setLabel(CONFIG.TICKETS.apply_seller.label).setEmoji(CONFIG.EMOJIS.APPLY_SELLER).setStyle(ButtonStyle.Secondary)
            );

            await interaction.channel.send({ embeds: [ticketEmbed], components: [row1, row2] });
            return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Ticket Panel sent successfully!`, ephemeral: true });
        }

        if (interaction.commandName === 'givefreespin') {
            const hasRole = interaction.member.roles.cache.has(CONFIG.FREE_SPIN_ADMIN_ROLE_ID);
            if (!hasRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} No permission!`, ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const hours = interaction.options.getNumber('hours');

            cleanExpiredSpins();
            const spinsData = getFreeSpinsData();
            const expiresAt = Date.now() + (hours * 60 * 60 * 1000);
            const currentAmount = spinsData[targetUser.id] ? spinsData[targetUser.id].amount : 0;

            spinsData[targetUser.id] = { amount: currentAmount + amount, expiresAt: expiresAt };
            saveFreeSpinsData(spinsData);

            return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Granted **${amount}** Free Spin(s) to <@${targetUser.id}>!` });
        }

        if (interaction.commandName === 'spin') {
            if (interaction.channel.parentId !== CONFIG.TICKETS.spin.categoryId) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Use this inside a Spin ticket!`, ephemeral: true });
            }
            // Code Spin Wheel Logic ...
        }
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_rename_ticket') {
            const newName = interaction.fields.getTextInputValue('input_ticket_name');
            await interaction.channel.setName(newName);
            return interaction.reply({ content: `${CONFIG.EMOJIS.PENCIL} Ticket renamed to: \`${newName}\`` });
        }

        if (interaction.customId === 'modal_apply_seller') {
            const name = interaction.fields.getTextInputValue('app_name');
            const age = interaction.fields.getTextInputValue('app_age');
            const servers = interaction.fields.getTextInputValue('app_servers');
            const feedback = interaction.fields.getTextInputValue('app_feedback');
            const ranks = interaction.fields.getTextInputValue('app_ranks');

            const resultEmbed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle("📋 New Seller Application Submitted")
                .addFields(
                    { name: "ما هو اسمك الحقيقي", value: name },
                    { name: "ما هو عمرك", value: age },
                    { name: "ما عدد السيرفرات التي انت شغال فيها", value: servers },
                    { name: "معاك 10 فيدباك نعم او لا", value: feedback },
                    { name: "ما هي رتب البيع التي تقدم عليها انت", value: ranks }
                )
                .setTimestamp();

            await interaction.channel.send({ content: `**طلب جديد من <@${interaction.user.id}>**`, embeds: [resultEmbed] });
            await interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} تم إرسال طلبك بنجاح!`, ephemeral: true });

            // Send +come to seller management role
            await interaction.channel.send(`+come <@&${CONFIG.TICKETS.apply_seller.roleId}>`);

            // DM Members of that role
            const role = interaction.guild.roles.cache.get(CONFIG.TICKETS.apply_seller.roleId);
            if (role) {
                role.members.forEach(member => {
                    member.send(`🔔 **طلب بائع جديد!** هناك تقديم جديد من <@${interaction.user.id}> في الروم: ${interaction.channel}`).catch(() => {});
                });
            }
        }
    }

    // Buttons
    if (interaction.isButton()) {
        
        if (interaction.customId === 'btn_click_apply') {
            const modal = new ModalBuilder().setCustomId('modal_apply_seller').setTitle('Apply Team Submit');

            const input1 = new TextInputBuilder().setCustomId('app_name').setLabel('ما هو اسمك الحقيقي').setStyle(TextInputStyle.Short).setRequired(true);
            const input2 = new TextInputBuilder().setCustomId('app_age').setLabel('ما هو عمرك').setStyle(TextInputStyle.Short).setRequired(true);
            const input3 = new TextInputBuilder().setCustomId('app_servers').setLabel('ما عدد السيرفرات التي انت شغال فيها').setStyle(TextInputStyle.Short).setRequired(true);
            const input4 = new TextInputBuilder().setCustomId('app_feedback').setLabel('معاك 10 فيدباك نعم او لا').setStyle(TextInputStyle.Short).setRequired(true);
            const input5 = new TextInputBuilder().setCustomId('app_ranks').setLabel('ما هي رتب البيع التي تقدم عليها انت').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input1),
                new ActionRowBuilder().addComponents(input2),
                new ActionRowBuilder().addComponents(input3),
                new ActionRowBuilder().addComponents(input4),
                new ActionRowBuilder().addComponents(input5)
            );

            return interaction.showModal(modal);
        }

        if (interaction.customId === 'ticket_close') {
            await interaction.reply({ content: `${CONFIG.EMOJIS.LOCK} Closing ticket in 5 seconds...` });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return;
        }

        if (interaction.customId === 'ticket_claim') {
            const ticketConfig = getTicketTypeByChannel(interaction.channel);
            if (ticketConfig) {
                const hasStaffRole = interaction.member.roles.cache.has(ticketConfig.roleId);
                if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Only staff members can claim!`, ephemeral: true });
                }
            }
            const newName = `claimed-by-${interaction.user.username}`;
            await interaction.channel.setName(newName);
            return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Claimed by **<@${interaction.user.id}>**!` });
        }

        const typeMap = {
            'btn_pub': CONFIG.TICKETS.pub,
            'btn_bugs': CONFIG.TICKETS.bugs,
            'btn_remplacement': CONFIG.TICKETS.remplacement,
            'btn_donate': CONFIG.TICKETS.donate,
            'btn_spin': CONFIG.TICKETS.spin,
            'btn_buy_order': CONFIG.TICKETS.buy_order,
            'btn_apply_seller': CONFIG.TICKETS.apply_seller
        };

        const selectedTicket = typeMap[interaction.customId];
        if (!selectedTicket) return;

        const category = interaction.guild.channels.cache.get(selectedTicket.categoryId);
        if (!category) return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Category not found! Check CONFIG.`, ephemeral: true });

        const ticketChannel = await interaction.guild.channels.create({
            name: `${selectedTicket.name.toLowerCase()}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: selectedTicket.roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
            ]
        });

        const ticketControlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji(CONFIG.EMOJIS.DELETE).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji(CONFIG.EMOJIS.CLAIM).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_rename').setLabel('Rename').setEmoji(CONFIG.EMOJIS.RENAME).setStyle(ButtonStyle.Secondary)
        );

        // Buy Order Panel (Echo Bot Style)
        if (interaction.customId === 'btn_buy_order') {
            const buyEmbed = new EmbedBuilder()
                .setColor("#d4af37")
                .setThumbnail(interaction.guild.iconURL())
                .setDescription(
                    `⚜️ **السلام عليكم ورحمة الله وبركاته**\n` +
                    `⚜️ **معك طاقم العمل لدى متجرنا في تذكرة الطلب**\n` +
                    `⚜️ **يرجى تحديد طلبك باستخدام الأمر التالي:**\n\n` +
                    `\`\`\`\nneed <product>\nneed <اسم المنتج>\n\`\`\``
                );

            await ticketChannel.send({ embeds: [buyEmbed], components: [ticketControlRow] });
        } 
        // Apply Seller Panel
        else if (interaction.customId === 'btn_apply_seller') {
            const applyEmbed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setDescription(
                    `**Click On The Button To Start Team Apply Submit**\n` +
                    `برجاء الضغط علي البتن لبدئ التقديم الي طاقم العمل\n\n` +
                    `⚠️ **ملحوظه : لو مضغطتش علي البتن و كملت مع البوت محدش هيرد عليك**`
                );

            const applyBtnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_click_apply').setLabel('Click Here').setStyle(ButtonStyle.Primary)
            );

            await ticketChannel.send({ embeds: [applyEmbed], components: [applyBtnRow, ticketControlRow] });
        } 
        // Standard Tickets
        else {
            const embedMsg = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle(`Ticket: ${selectedTicket.name}`)
                .setDescription(`Welcome <@${interaction.user.id}>! Staff will assist you shortly.`)
                .setThumbnail(client.user.displayAvatarURL());

            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embedMsg], components: [ticketControlRow] });
        }

        return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Ticket opened: ${ticketChannel}`, ephemeral: true });
    }
});

client.login(CONFIG.TOKEN);
